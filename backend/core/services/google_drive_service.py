import io
import logging
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError
from google.oauth2 import service_account
from django.conf import settings

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.metadata",
]

def _get_drive_service():
    sa_file = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", None)
    if not sa_file:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_FILE não configurado em settings.")
    creds = service_account.Credentials.from_service_account_file(sa_file, scopes=SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)

_drive_service = None
def _service():
    global _drive_service
    if _drive_service is None:
        _drive_service = _get_drive_service()
    return _drive_service

def find_folder(parent_id, name):
    """
    Procura por uma pasta com nome `name` dentro de parent_id.
    Retorna metadata da primeira pasta ou None.
    """
    try:
        svc = _service()
        safe_name = name.replace("'", "\\'")
        q = (
            "mimeType='application/vnd.google-apps.folder' and "
            f"name = '{safe_name}' and "
            f"'{parent_id}' in parents and trashed = false"
        )
        res = svc.files().list(
            q=q,
            fields="files(id, name, mimeType, webViewLink)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        files = res.get("files", [])
        return files[0] if files else None
    except HttpError as e:
        logger.exception("Erro find_folder: %s", e)
        raise

def create_folder(name, parent_id=None):
    svc = _service()
    body = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        body["parents"] = [parent_id]
    created = svc.files().create(
        body=body,
        fields="id, name, webViewLink, driveId",
        supportsAllDrives=True
    ).execute()
    return created

def ensure_folder(parent_id, name):
    found = find_folder(parent_id, name)
    return found if found else create_folder(name, parent_id)

def copy_file(file_id, new_title=None, parent_id=None):
    svc = _service()
    body = {}
    if new_title:
        body["name"] = new_title
    if parent_id:
        body["parents"] = [parent_id]
    try:
        copied = svc.files().copy(
            fileId=file_id,
            body=body,
            fields="id, name, webViewLink, driveId",
            supportsAllDrives=True
        ).execute()
        return copied
    except HttpError as e:
        logger.exception("Erro ao copiar arquivo %s: %s", file_id, e)
        raise

def upload_file(parent_id, filename, fileobj, mimetype=None):
    svc = _service()
    try:
        fileobj.seek(0)
    except Exception:
        pass

    media = MediaIoBaseUpload(fileobj, mimetype=mimetype or "application/octet-stream", resumable=True)
    body = {
        "name": filename,
        "parents": [parent_id] if parent_id else []
    }
    try:
        created = svc.files().create(
            body=body,
            media_body=media,
            fields="id, name, webViewLink, webContentLink, driveId",
            supportsAllDrives=True
        ).execute()
        return created
    except HttpError as e:
        logger.exception("Erro upload_file %s: %s", filename, e)
        raise

def set_permission(file_id, role="reader", perm_type="user", email=None, allow_file_discovery=False):
    svc = _service()
    body = {"role": role, "type": perm_type}
    if perm_type == "user" and email:
        body["emailAddress"] = email
    if perm_type == "anyone":
        body["allowFileDiscovery"] = allow_file_discovery

    try:
        perm = svc.permissions().create(
            fileId=file_id,
            body=body,
            supportsAllDrives=True,  # Permissões em Shared Drives
            sendNotificationEmail=False
        ).execute()
        return perm
    except HttpError as e:
        logger.exception("Erro set_permission em %s: %s", file_id, e)
        raise

def get_file_link(file_id):
    svc = _service()
    try:
        meta = svc.files().get(
            fileId=file_id,
            fields="id, name, webViewLink, driveId",
            supportsAllDrives=True
        ).execute()
        return meta.get("webViewLink")
    except HttpError as e:
        logger.exception("Erro get_file_link: %s", e)
        return None

def get_folder_link(folder_id):
    return get_file_link(folder_id)
