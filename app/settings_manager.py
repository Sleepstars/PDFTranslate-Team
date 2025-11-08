from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import SystemSetting

DEFAULT_S3_REGION = "us-east-1"
DEFAULT_S3_TTL_DAYS = 7
REQUIRED_S3_FIELDS = ("access_key", "secret_key", "bucket")


class MissingS3Configuration(RuntimeError):
    """Raised when strict S3 configuration is requested but not fully configured."""


async def _get_setting_value(db: AsyncSession, key: str) -> str:
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    return setting.value if setting and setting.value is not None else ""


async def get_s3_config(db: AsyncSession, *, strict: bool = False) -> dict:
    """Get S3 configuration from database settings only."""
    endpoint = await _get_setting_value(db, "s3_endpoint")
    access_key = await _get_setting_value(db, "s3_access_key")
    secret_key = await _get_setting_value(db, "s3_secret_key")
    bucket = await _get_setting_value(db, "s3_bucket")
    region = await _get_setting_value(db, "s3_region") or DEFAULT_S3_REGION
    ttl_raw = await _get_setting_value(db, "s3_file_ttl_days")

    try:
        ttl_days = int(ttl_raw) if ttl_raw else DEFAULT_S3_TTL_DAYS
    except ValueError:
        ttl_days = DEFAULT_S3_TTL_DAYS

    config = {
        "endpoint": endpoint or "",
        "access_key": access_key or "",
        "secret_key": secret_key or "",
        "bucket": bucket or "",
        "region": region,
        "ttl_days": ttl_days
    }

    if strict:
        missing = [field for field in REQUIRED_S3_FIELDS if not config[field]]
        if missing:
            readable = ", ".join(missing)
            raise MissingS3Configuration(
                f"S3 storage is not fully configured (missing: {readable}). "
                "Please open Admin > Settings > S3 to complete the configuration."
            )

    return config
