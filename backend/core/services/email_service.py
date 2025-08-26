from django.core.mail import send_mail, EmailMessage, EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string
from email.utils import make_msgid
import logging

logger = logging.getLogger(__name__)
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

def send_process_created_email(
    processo,
    controle_emails: list[str],
    requester_email: str | None = None,
    doc_url: str | None = None,
    folder_url: str | None = None,
    reply_to_message_id: str | None = None,   # ⬅️ novo nome, opcional
):
    to_list = list(controle_emails or [])
    if not to_list:
        logger.warning("Sem destinatários de Controle Interno para processo %s; e-mail não enviado.", processo.id)
        return None

# corpo para controle interno
    assunto = f"[Diárias] Nova solicitação {processo.numero}/{processo.ano} - {processo.solicitante.get_full_name()}"

    corpo = (
        f"Foi aberta uma solicitação de diária.\n\n"
        f"Número: {processo.numero}/{processo.ano}\n"
        f"Solicitante: {processo.solicitante.get_full_name()} ({processo.solicitante.email})\n"
        f"Destino: {processo.destino}\n\n"
        f"Documento: {doc_url or '-'}\n"
        f"Pasta: {folder_url or '-'}\n"
    )

    
     # headers para threading
    headers = {}
    message_id = make_msgid(domain=getattr(settings, "EMAIL_MESSAGE_ID_DOMAIN", None))
    headers["Message-ID"] = message_id
    if reply_to_message_id:
        headers["In-Reply-To"] = reply_to_message_id
        headers["References"] = reply_to_message_id

    msg = EmailMultiAlternatives(
        subject=assunto,
        body=corpo,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=to_list,
        cc=[requester_email] if requester_email else None,
        headers=headers,
    )
    msg.send(fail_silently=False)
    logger.info("Email enviado para %s (cc: %s) — Message-ID=%s", to_list, requester_email, message_id)
    return message_id
