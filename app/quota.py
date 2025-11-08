from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User
from PyPDF2 import PdfReader
from io import BytesIO


async def reset_quota_if_needed(user: User, db: AsyncSession) -> None:
    """Reset user quota if it's a new day (UTC)"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    last_reset = user.last_quota_reset.replace(tzinfo=None) if user.last_quota_reset.tzinfo else user.last_quota_reset
    
    # Check if it's a new day
    if last_reset.date() < now.date():
        user.daily_page_used = 0
        user.last_quota_reset = now
        await db.commit()


async def check_quota(user: User, page_count: int, db: AsyncSession) -> tuple[bool, str]:
    """
    Check if user has enough quota for the given page count.
    Returns (has_quota, error_message)
    """
    await reset_quota_if_needed(user, db)
    
    remaining = user.daily_page_limit - user.daily_page_used
    
    if page_count > remaining:
        return False, f"Insufficient quota. You have {remaining} pages remaining today, but need {page_count} pages."
    
    return True, ""


async def consume_quota(user: User, page_count: int, db: AsyncSession) -> None:
    """Consume user quota"""
    user.daily_page_used += page_count
    await db.commit()


async def refund_quota(user: User, page_count: int, db: AsyncSession) -> None:
    """Refund user quota (e.g., when task fails)"""
    user.daily_page_used = max(0, user.daily_page_used - page_count)
    await db.commit()


def count_pdf_pages(file_content: bytes) -> int:
    """Count pages in a PDF file"""
    try:
        pdf_reader = PdfReader(BytesIO(file_content))
        return len(pdf_reader.pages)
    except Exception:
        # If we can't read the PDF, assume 1 page to allow the task to proceed
        # The actual validation will happen during translation
        return 1


async def get_quota_status(user_id: str, db: AsyncSession) -> dict:
    """Get user's current quota status"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return {
            "dailyPageLimit": 0,
            "dailyPageUsed": 0,
            "remaining": 0,
            "lastQuotaReset": None
        }
    
    await reset_quota_if_needed(user, db)
    await db.refresh(user)
    
    return {
        "dailyPageLimit": user.daily_page_limit,
        "dailyPageUsed": user.daily_page_used,
        "remaining": user.daily_page_limit - user.daily_page_used,
        "lastQuotaReset": user.last_quota_reset.isoformat()
    }

