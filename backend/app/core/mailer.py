"""Kirim email (opsional). Tanpa SMTP_HOST, email tidak dikirim dan admin membuat tautan reset manual."""
import logging
import smtplib
from email.message import EmailMessage

from app.core import config

log = logging.getLogger(__name__)


def enabled() -> bool:
    return bool(config.SMTP_HOST and config.SMTP_FROM)


def send(to: str, subject: str, body: str) -> bool:
    if not enabled():
        return False
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = config.SMTP_FROM, to, subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as s:
            s.starttls()
            if config.SMTP_USER:
                s.login(config.SMTP_USER, config.SMTP_PASSWORD)
            s.send_message(msg)
        return True
    except Exception:
        log.exception("Gagal mengirim email ke %s", to)
        return False
