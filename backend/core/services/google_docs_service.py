# core/services/google_docs_service.py
import io
import logging
from django.conf import settings

# As importações do Google API são opcionais para evitar falhas de import
# quando o pacote `google-api-python-client` não estiver disponível. Assim,
# módulos que não utilizam o Google Docs podem ser carregados normalmente.
try:  # pragma: no cover - comportamento dependente de ambiente
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    from google.oauth2 import service_account
except ModuleNotFoundError:  # pragma: no cover
    build = MediaIoBaseDownload = service_account = None

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive"
]

def _get_docs_service():
    if build is None or service_account is None:
        raise ModuleNotFoundError(
            "google-api-python-client não está instalado. "
            "Instale a dependência para utilizar o Google Docs."
        )

    sa_file = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", None)
    if not sa_file:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_FILE não configurado em settings.")

    creds = service_account.Credentials.from_service_account_file(sa_file, scopes=SCOPES)
    return build("docs", "v1", credentials=creds, cache_discovery=False)

_docs_service = None
def _service():
    global _docs_service
    if _docs_service is None:
        _docs_service = _get_docs_service()
    return _docs_service

def replace_tags(document_id, replacements: dict):
    """
    replacements: dict { 'TAG_NAME': 'valor' } -> procura por <<TAG_NAME>> e substitui.
    """
    svc = _service()
    requests = []
    for key, val in (replacements or {}).items():
        if val is None:
            val = ""
        find_text = f'<<{key}>>'
        requests.append({
            "replaceAllText": {
                "containsText": {
                    "text": find_text,
                    "matchCase": True
                },
                "replaceText": str(val)
            }
        })
    if not requests:
        return {"replacements": 0}
    body = {"requests": requests}
    try:
        res = svc.documents().batchUpdate(documentId=document_id, body=body).execute()
        return res
    except Exception as e:
        logger.exception("Erro replace_tags no documento %s: %s", document_id, e)
        raise

def export_to_pdf(document_id):
    """
    Retorna bytes do PDF exportado do Google Docs (via Drive export).
    """
    # usamos Drive export via API Drive
    if build is None or service_account is None or MediaIoBaseDownload is None:
        raise ModuleNotFoundError(
            "google-api-python-client não está instalado. "
            "Instale a dependência para exportar documentos."
        )

    sa_file = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", None)
    if not sa_file:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_FILE não configurado em settings.")
    creds = service_account.Credentials.from_service_account_file(
        sa_file, scopes=["https://www.googleapis.com/auth/drive"]
    )
    drive_svc = build("drive", "v3", credentials=creds, cache_discovery=False)
    request = drive_svc.files().export_media(fileId=document_id, mimeType="application/pdf")
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    try:
        while not done:
            status, done = downloader.next_chunk()
        fh.seek(0)
        return fh.read()
    except Exception as e:
        logger.exception("Erro ao exportar documento %s para PDF: %s", document_id, e)
        raise
