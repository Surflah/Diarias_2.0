from django.core.mail import send_mail, EmailMessage
from django.conf import settings
from django.template.loader import render_to_string
import logging

# (novo) para montar links do Drive se vier apenas o ID no Processo
try:
    from core.services import google_drive_service
except Exception:
    google_drive_service = None

logger = logging.getLogger(__name__)

DEFAULT_FROM = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "no-reply@example.com"
EMAIL_DOMAIN = getattr(settings, "EMAIL_DOMAIN", None) or "camaraitapoa.local"

def _template_exists(path):
    from django.template import TemplateDoesNotExist
    from django.template.loader import get_template
    try:
        get_template(path)
        return True
    except Exception:
        return False

def _resolve_links(processo, doc_url, folder_url):
    """
    Garante que tenhamos URLs clicáveis para doc/pasta:
    - Usa os valores passados (preferência)
    - Se não vierem, tenta resolver a partir dos IDs gravados no processo
    """
    resolved_doc_url = doc_url or ""
    resolved_folder_url = folder_url or ""

    # tentar resolver link da pasta pelo ID
    if not resolved_folder_url:
        fid = getattr(processo, "gdrive_folder_id", "") or ""
        if fid and google_drive_service:
            try:
                resolved_folder_url = google_drive_service.get_folder_link(fid) or ""
            except Exception:
                pass

    # Doc: só resolvemos se você futuramente armazenar um ID do doc no processo
    # (gdrive_doc_id). Por ora mantemos vazio se não vier por parâmetro.
    if not resolved_doc_url:
        did = getattr(processo, "gdrive_doc_id", "") or ""
        if did and google_drive_service:
            try:
                # não há um get_doc_link pronto; normalmente é o webViewLink do arquivo
                # se você criar uma função get_file_link(did), pode usá-la aqui:
                resolved_doc_url = google_drive_service.get_file_link(did) or ""
            except Exception:
                pass

    return resolved_doc_url, resolved_folder_url

def _make_thread_message_id(processo):
    """
    Gera um Message-ID determinístico por processo para facilitar threading básico.
    Observação: alguns provedores podem sobrescrever o Message-ID.
    """
    pid = getattr(processo, "id", None) or "x"
    num = getattr(processo, "numero", None) or "x"
    ano = getattr(processo, "ano", None) or "x"
    return f"<diaria-{pid}-{num}-{ano}@{EMAIL_DOMAIN}>"

def send_process_created_email(processo, controle_emails, requester_email=None, doc_url=None, folder_url=None, in_reply_to=None):
    """
    Envia:
      - para controle_interno: notificação de nova solicitação
      - para solicitante: confirmação
    Usa templates se existirem em templates/emails/.

    Parâmetros adicionais:
      - doc_url, folder_url: URLs clicáveis (se não vierem, tenta resolver por IDs do processo)
      - in_reply_to: Message-ID do email anterior (se quiser threadar manualmente)
                     (opcional; em fases futuras você pode persistir/recuperar isso do banco)
    """
    numero = getattr(processo, "numero", None)
    ano = getattr(processo, "ano", None)

    subject_internal = f"Nova Solicitação de Diária #{numero}-{ano} - Aguardando Análise"
    subject_requester = f"Sua solicitação de diária #{numero}-{ano} foi criada"

    # resolve links
    link_doc, link_folder = _resolve_links(processo, doc_url, folder_url)

    contexto = {
        "processo": processo,
        "numero": numero,
        "ano": ano,
        "link_doc": link_doc,
        "link_folder": link_folder,
    }

    # corpo para controle interno
    internal_txt = "templates/emails/new_process_internal.txt"
    if _template_exists(internal_txt):
        body_internal = render_to_string(internal_txt, contexto)
    else:
        body_internal = (
            f"Nova solicitação de diária #{numero}-{ano}.\n\n"
            f"Solicitante: {processo.solicitante.get_full_name() if hasattr(processo.solicitante, 'get_full_name') else processo.solicitante}\n"
            f"Pasta do processo: {link_folder}\n"
            f"Documento: {link_doc}\n"
        )

    # corpo para solicitante
    requester_txt = "templates/emails/new_process_requester.txt"
    if _template_exists(requester_txt):
        body_requester = render_to_string(requester_txt, contexto)
    else:
        body_requester = (
            f"Sua solicitação de diária #{numero}-{ano} foi criada com sucesso.\n\n"
            f"Pasta do processo: {link_folder}\n"
            f"Documento: {link_doc}\n"
        )

    # Cabeçalhos para threading básico
    base_msg_id = _make_thread_message_id(processo)
    headers_internal = {"Message-ID": base_msg_id}
    if in_reply_to:
        headers_internal["In-Reply-To"] = in_reply_to
        headers_internal["References"] = in_reply_to

    # enviar para controle interno
    try:
        if controle_emails:
            EmailMessage(
                subject_internal,
                body_internal,
                DEFAULT_FROM,
                to=controle_emails,
                headers=headers_internal
            ).send(fail_silently=False)
    except Exception as e:
        logger.exception("Falha ao enviar email para controle interno: %s", e)

    # enviar para solicitante — na mesma thread (se desejar)
    try:
        if requester_email:
            headers_requester = {"In-Reply-To": base_msg_id, "References": base_msg_id, "Message-ID": f"{base_msg_id}.req"}
            EmailMessage(
                subject_requester,
                body_requester,
                DEFAULT_FROM,
                to=[requester_email],
                headers=headers_requester
            ).send(fail_silently=False)
    except Exception as e:
        logger.exception("Falha ao enviar email para solicitante: %s", e)

    # opcional: retornar o Message-ID base caso você queira persistir
    return base_msg_id
