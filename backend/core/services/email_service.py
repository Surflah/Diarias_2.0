# core/services/email_service.py
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string, get_template
import logging

logger = logging.getLogger(__name__)

DEFAULT_FROM = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "no-reply@example.com"

def _template_exists(path):
    from django.template import TemplateDoesNotExist
    from django.template.loader import get_template
    try:
        get_template(path)
        return True
    except Exception:
        return False

def send_process_created_email(processo, controle_emails, requester_email=None):
    """
    Envia:
      - para controle_interno: notificação de nova solicitação
      - para solicitante: confirmação
    Usa templates se existirem em templates/emails/.
    """
    numero = getattr(processo, "numero", None)
    ano = getattr(processo, "ano", None)

    subject_internal = f"Nova Solicitação de Diária #{numero}-{ano} - Aguardando Análise"
    subject_requester = f"Sua solicitação de diária #{numero}-{ano} foi criada"

    contexto = {
        "processo": processo,
        "numero": numero,
        "ano": ano,
        "link_doc": getattr(processo, "gdrive_doc_id", "") or "",
        "link_folder": getattr(processo, "gdrive_folder_id", "") or ""
    }

    # corpo para controle interno
    internal_txt = "templates/emails/new_process_internal.txt"
    if _template_exists(internal_txt):
        body_internal = render_to_string(internal_txt, contexto)
    else:
        body_internal = (
            f"Nova solicitação de diária #{numero}-{ano}.\n\n"
            f"Solicitante: {processo.solicitante.get_full_name() if hasattr(processo.solicitante, 'get_full_name') else processo.solicitante}\n"
            f"Acesse a pasta: {contexto['link_folder']}\n"
        )

    # corpo para solicitante
    requester_txt = "templates/emails/new_process_requester.txt"
    if _template_exists(requester_txt):
        body_requester = render_to_string(requester_txt, contexto)
    else:
        body_requester = (
            f"Sua solicitação de diária #{numero}-{ano} foi criada com sucesso.\n\n"
            f"Acesse a pasta: {contexto['link_folder']}\n"
        )

    # enviar para controle interno
    try:
        if controle_emails:
            send_mail(subject_internal, body_internal, DEFAULT_FROM, controle_emails, fail_silently=False)
    except Exception as e:
        logger.exception("Falha ao enviar email para controle interno: %s", e)

    # enviar para solicitante
    try:
        if requester_email:
            send_mail(subject_requester, body_requester, DEFAULT_FROM, [requester_email], fail_silently=False)
    except Exception as e:
        logger.exception("Falha ao enviar email para solicitante: %s", e)
