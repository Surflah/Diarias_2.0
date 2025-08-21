# core/services/orquestrador_gdrive.py
import logging
from django.conf import settings
from .google_drive_service import ensure_folder, copy_file, upload_file, set_permission, get_folder_link, get_file_link, find_folder
from .google_docs_service import replace_tags
from core.models import Documento
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()

def _normalize_process_folder_name(numero, ano, solicitante_name):
    # ex.: Diaria 324-2025 - João Silva
    return f"Diaria {numero}-{ano} - {solicitante_name}"

def create_process_folder_and_doc(processo, replacements: dict, attachments: list, root_drive_id: str, template_id: str, controle_interno_emails: list = None, requester_email: str = None):
    """
    Orquestra:
     - ano folder -> process folder -> '1 - Documentos recebidos na requisição'
     - copia template para a pasta '1 - Documentos recebidos na requisição'
     - faz replace_tags no documento copiado
     - seta permissões (requester: view, controle interno: edit)
     - faz upload dos attachments na mesma pasta e cria objetos Documento no DB
    Retorna dict com process_folder_id, doc_id, doc_url, folder_url e lista de Documentos criados.
    """
    if controle_interno_emails is None:
        controle_interno_emails = []

    root_id = root_drive_id
    ano = processo.ano
    numero = processo.numero
    # solicitante pode ser User FK in Processo model
    solicitante_user = getattr(processo, "solicitante", None)
    solicitante_name = solicitante_user.get_full_name() if hasattr(solicitante_user, "get_full_name") else str(solicitante_user)

    # 1) ensure ano folder
    ano_folder = ensure_folder(root_id, str(ano))
    ano_folder_id = ano_folder.get("id") if isinstance(ano_folder, dict) else ano_folder.get('id')

    # 2) ensure process folder
    process_folder_name = _normalize_process_folder_name(numero, ano, solicitante_name)
    process_folder = ensure_folder(ano_folder_id, process_folder_name)
    process_folder_id = process_folder.get("id") if isinstance(process_folder, dict) else process_folder.get('id')

    # 3) ensure '1 - Documentos recebidos na requisição'
    recebidos_folder = ensure_folder(process_folder_id, "1 - Documentos recebidos na requisição")
    recebidos_folder_id = recebidos_folder.get("id") if isinstance(recebidos_folder, dict) else recebidos_folder.get('id')

    # 4) copiar template para recebidos_folder
    copied = copy_file(file_id=template_id, new_title=process_folder_name, parent_id=recebidos_folder_id)
    doc_id = copied.get("id")
    doc_url = copied.get("webViewLink")

    # 5) substituir tags no documento copiado
    try:
        replace_tags(doc_id, replacements)
    except Exception:
        logger.exception("Falha ao substituir tags no doc %s", doc_id)

    created_documents = []

    # 6) cria registro Documento para o próprio documento copiado (SOLICITACAO_INICIAL)
    try:
        doc_record = Documento.objects.create(
            processo=processo,
            nome_arquivo=copied.get("name") or f"Diaria_{numero}_{ano}",
            gdrive_file_id=copied.get("id"),
            tipo_documento=Documento.TipoDocumento.SOLICITACAO_INICIAL,
            uploaded_by=solicitante_user
        )
        created_documents.append(doc_record)
    except Exception:
        logger.exception("Falha ao criar registro Documento para o doc copiado (processo %s)", processo.id)

    # 7) setar permissões
    # solicitante -> reader
    if requester_email:
        try:
            set_permission(doc_id, role="reader", perm_type="user", email=requester_email)
        except Exception:
            logger.exception("Falha ao setar permissão reader para solicitante %s", requester_email)

    # controle interno -> writer
    for email in (controle_interno_emails or []):
        try:
            set_permission(doc_id, role="writer", perm_type="user", email=email)
        except Exception:
            logger.exception("Falha ao setar permissão writer para %s", email)

    # 8) upload attachments - cada anexo vira Documento(tipo OUTRO)
    for f in (attachments or []):
        try:
            # file-like object (Django UploadedFile)
            # upload_file já seeka para 0
            uploaded = upload_file(parent_id=recebidos_folder_id, filename=getattr(f, "name", "anexo"), fileobj=f, mimetype=getattr(f, "content_type", None))
            doc_obj = Documento.objects.create(
                processo=processo,
                nome_arquivo=getattr(f, "name", "anexo"),
                gdrive_file_id=uploaded.get("id"),
                tipo_documento=Documento.TipoDocumento.OUTRO,
                uploaded_by=solicitante_user
            )
            created_documents.append(doc_obj)
        except Exception:
            logger.exception("Falha ao fazer upload do anexo %s para processo %s", getattr(f, "name", "anexo"), processo.id)

    folder_url = get_folder_link(process_folder_id)

    return {
        "process_folder_id": process_folder_id,
        "recebidos_folder_id": recebidos_folder_id,
        "doc_id": doc_id,
        "doc_url": doc_url,
        "folder_url": folder_url,
        "uploaded_documents": created_documents
    }
