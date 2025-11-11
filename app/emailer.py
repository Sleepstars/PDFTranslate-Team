from __future__ import annotations

import smtplib
from email.message import EmailMessage
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import SystemSetting
import asyncio


async def send_email(db: AsyncSession, to_email: str, subject: str, text: str, html: Optional[str] = None) -> None:
    """
    Send an email using SMTP settings stored in system_settings.
    Falls back gracefully if settings are incomplete by raising ValueError.
    This function offloads blocking SMTP operations to a thread.
    """

    async def _get(key: str) -> str:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        return row.value if row and row.value is not None else ""

    host = await _get("smtp_host")
    port_raw = await _get("smtp_port")
    username = await _get("smtp_username")
    password = await _get("smtp_password")
    use_tls = (await _get("smtp_use_tls")).lower() in ("true", "1", "yes", "y")
    from_email = await _get("smtp_from_email")

    if not host or not port_raw or not from_email:
        raise ValueError("SMTP is not configured: host/port/from_email are required")

    try:
        port = int(port_raw)
    except ValueError:
        raise ValueError("Invalid SMTP port")

    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    if html:
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
    else:
        msg.set_content(text)

    def _send():
        if use_tls:
            # Use STARTTLS
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.starttls()
                if username and password:
                    server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if username and password:
                    server.login(username, password)
                server.send_message(msg)

    await asyncio.to_thread(_send)

