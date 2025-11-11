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


async def send_verification_email(db: AsyncSession, to_email: str, verification_url: str, user_name: str) -> None:
    """
    Send an email verification link to the user.
    """
    subject = "Verify your email address"

    text = f"""Hello {user_name},

Thank you for registering! Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 30 minutes.

If you did not create an account, please ignore this email.

Best regards,
PDFTranslate Team"""

    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Verify Your Email Address</h2>
            <p>Hello {user_name},</p>
            <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verification_url}"
                   style="background-color: #3498db; color: white; padding: 12px 30px;
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    Verify Email Address
                </a>
            </div>
            <p style="color: #7f8c8d; font-size: 14px;">
                Or copy and paste this link into your browser:<br>
                <a href="{verification_url}" style="color: #3498db;">{verification_url}</a>
            </p>
            <p style="color: #7f8c8d; font-size: 14px;">
                This link will expire in 30 minutes.
            </p>
            <p style="color: #7f8c8d; font-size: 14px;">
                If you did not create an account, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
            <p style="color: #95a5a6; font-size: 12px;">
                Best regards,<br>
                PDFTranslate Team
            </p>
        </div>
    </body>
    </html>
    """

    await send_email(db, to_email, subject, text, html)

