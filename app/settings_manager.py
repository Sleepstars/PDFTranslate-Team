from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import SystemSetting
from .config import get_settings

async def get_runtime_setting(db: AsyncSession, key: str, default: str = "") -> str:
    """Get setting from database, fallback to env var"""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        return setting.value

    settings = get_settings()
    return getattr(settings, key, default)

async def get_s3_config(db: AsyncSession) -> dict:
    """Get S3 configuration from database or env"""
    settings = get_settings()
    return {
        "endpoint": await get_runtime_setting(db, "s3_endpoint", settings.s3_endpoint),
        "access_key": await get_runtime_setting(db, "s3_access_key", settings.s3_access_key),
        "secret_key": await get_runtime_setting(db, "s3_secret_key", settings.s3_secret_key),
        "bucket": await get_runtime_setting(db, "s3_bucket", settings.s3_bucket),
        "region": await get_runtime_setting(db, "s3_region", settings.s3_region),
        "ttl_days": int(await get_runtime_setting(db, "s3_file_ttl_days", str(settings.s3_file_ttl_days)))
    }
