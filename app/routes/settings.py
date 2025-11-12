from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from ..database import get_db
from ..models import SystemSetting, User
from ..dependencies import require_admin
from ..settings_manager import get_s3_config
from ..s3_client import S3Client
from ..schemas import (
    SystemSettingsResponse,
    UpdateSystemSettingsRequest,
    EmailSettingsResponse,
    UpdateEmailSettingsRequest,
    PerformanceSettingsResponse,
    UpdatePerformanceSettingsRequest,
    PerformanceMetricsResponse,
)

router = APIRouter(prefix="/admin/settings", tags=["settings"])


class S3ConfigRequest(BaseModel):
    endpoint: str = Field(default="", description="S3 endpoint URL (leave empty for AWS S3)")
    access_key: str = Field(..., min_length=1, description="S3 access key")
    secret_key: str = Field(..., min_length=1, description="S3 secret key")
    bucket: str = Field(..., min_length=1, description="S3 bucket name")
    region: str = Field(default="us-east-1", description="S3 region")
    ttl_days: int = Field(default=7, ge=1, le=365, description="File TTL in days")


class S3ConfigResponse(BaseModel):
    endpoint: str
    access_key: str
    bucket: str
    region: str
    ttl_days: int


# -----------------
# System Settings
# -----------------

@router.get("/system", response_model=SystemSettingsResponse)
async def get_system_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    async def get_setting(key: str) -> str:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        return row.value if row and row.value is not None else ""

    allow_registration = _parse_bool(await get_setting("allow_registration"), default=False)
    altcha_enabled = _parse_bool(await get_setting("altcha_enabled"), default=False)
    altcha_secret_key = await get_setting("altcha_secret_key")
    suffixes_raw = await get_setting("allowed_email_suffixes")
    suffixes = [s.strip() for s in suffixes_raw.split(",") if s.strip()] if suffixes_raw else []

    return SystemSettingsResponse(
        allowRegistration=allow_registration,
        altchaEnabled=altcha_enabled,
        altchaSecretKey=altcha_secret_key or None,
        allowedEmailSuffixes=suffixes
    )


@router.put("/system")
async def update_system_settings(
    request: UpdateSystemSettingsRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    settings_map: dict[str, str] = {}

    if request.allowRegistration is not None:
        settings_map["allow_registration"] = "true" if request.allowRegistration else "false"
    if request.altchaEnabled is not None:
        settings_map["altcha_enabled"] = "true" if request.altchaEnabled else "false"
    if request.altchaSecretKey is not None:
        settings_map["altcha_secret_key"] = request.altchaSecretKey
    if request.allowedEmailSuffixes is not None:
        settings_map["allowed_email_suffixes"] = ",".join([s.strip() for s in request.allowedEmailSuffixes if s.strip()])

    for key, value in settings_map.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(SystemSetting(key=key, value=value))

    await db.commit()

    from ..websocket_manager import admin_ws_manager
    await admin_ws_manager.broadcast("settings.system.updated", {})

    return {"message": "System settings updated"}


# -----------------
# Email (SMTP) Settings
# -----------------

def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.lower() in ("true", "1", "yes", "y")


@router.get("/email", response_model=EmailSettingsResponse)
async def get_email_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    async def get(key: str) -> str:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        return row.value if row and row.value is not None else ""

    host = await get("smtp_host")
    port_raw = await get("smtp_port")
    username = await get("smtp_username")
    use_tls = _parse_bool(await get("smtp_use_tls"), default=False)
    from_email = await get("smtp_from_email")
    suffixes_raw = await get("allowed_email_suffixes")

    try:
        port = int(port_raw) if port_raw else None
    except ValueError:
        port = None

    suffixes = [s.strip() for s in suffixes_raw.split(",") if s.strip()] if suffixes_raw else []

    return EmailSettingsResponse(
        smtpHost=host or None,
        smtpPort=port,
        smtpUsername=username or None,
        smtpUseTLS=use_tls,
        smtpFromEmail=from_email or None,
        allowedEmailSuffixes=suffixes,
    )


@router.put("/email")
async def update_email_settings(
    request: UpdateEmailSettingsRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    # Build key/value map; only persist provided fields, leave others untouched
    settings_map: dict[str, str] = {}

    if request.smtpHost is not None:
        settings_map["smtp_host"] = request.smtpHost
    if request.smtpPort is not None:
        settings_map["smtp_port"] = str(request.smtpPort)
    if request.smtpUsername is not None:
        settings_map["smtp_username"] = request.smtpUsername
    if request.smtpPassword is not None and request.smtpPassword != "":
        settings_map["smtp_password"] = request.smtpPassword
    if request.smtpUseTLS is not None:
        settings_map["smtp_use_tls"] = "true" if request.smtpUseTLS else "false"
    if request.smtpFromEmail is not None:
        settings_map["smtp_from_email"] = request.smtpFromEmail
    if request.allowedEmailSuffixes is not None:
        settings_map["allowed_email_suffixes"] = ",".join([s.strip() for s in request.allowedEmailSuffixes if s.strip()])

    for key, value in settings_map.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        if row:
            row.value = value
        else:
            db.add(SystemSetting(key=key, value=value))

    await db.commit()

    from ..websocket_manager import admin_ws_manager
    await admin_ws_manager.broadcast("settings.email.updated", {})

    return {"message": "Email settings updated"}


@router.post("/email/test")
async def send_test_email(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Send a test email to the admin's email address"""
    try:
        from ..emailer import send_email

        # Get admin's email
        admin_email = admin.email

        # Send test email
        subject = "测试邮件"
        text = """这是一封测试邮件。

如果您收到这封邮件，说明您的 SMTP 配置已经正确设置。

此邮件由系统自动发送，无需回复。
"""

        await send_email(db, admin_email, subject, text)

        return {"success": True, "message": f"测试邮件已发送到 {admin_email}"}
    except ValueError as e:
        # SMTP configuration is incomplete
        return {"success": False, "message": f"SMTP 配置不完整: {str(e)}"}
    except Exception as e:
        # SMTP connection or sending failed
        return {"success": False, "message": f"发送失败: {str(e)}"}


@router.get("/s3", response_model=S3ConfigResponse)
async def get_s3_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get S3 configuration (admin only)"""
    config = await get_s3_config(db)
    return S3ConfigResponse(
        endpoint=config["endpoint"],
        access_key=config["access_key"][:4] + "****" if config["access_key"] else "",
        bucket=config["bucket"],
        region=config["region"],
        ttl_days=config["ttl_days"]
    )


@router.put("/s3")
async def update_s3_settings(
    request: S3ConfigRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update S3 configuration (admin only)"""
    settings_map = {
        "s3_endpoint": request.endpoint,
        "s3_access_key": request.access_key,
        "s3_secret_key": request.secret_key,
        "s3_bucket": request.bucket,
        "s3_region": request.region,
        "s3_file_ttl_days": str(request.ttl_days)
    }

    for key, value in settings_map.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = str(value)
        else:
            db.add(SystemSetting(key=key, value=str(value)))

    await db.commit()

    from ..websocket_manager import admin_ws_manager
    await admin_ws_manager.broadcast("settings.s3.updated", {})

    return {"message": "S3 configuration updated successfully"}


@router.post("/s3/test")
async def test_s3_connection(
    request: S3ConfigRequest,
    admin: User = Depends(require_admin)
):
    """Test S3 connection with provided credentials (admin only)"""
    try:
        config = {
            "endpoint": request.endpoint,
            "access_key": request.access_key,
            "secret_key": request.secret_key,
            "bucket": request.bucket,
            "region": request.region,
            "ttl_days": request.ttl_days
        }

        s3_client = S3Client(config)
        # Try to list objects to verify connection
        s3_client.s3.head_bucket(Bucket=request.bucket)

        return {"success": True, "message": "S3 connection successful"}
    except Exception as e:
        return {"success": False, "message": f"S3 connection failed: {str(e)}"}


# -----------------
# Performance Settings
# -----------------

@router.get("/performance", response_model=PerformanceSettingsResponse)
async def get_performance_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get performance configuration (admin only)"""
    async def get_setting(key: str, default: str) -> str:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        return row.value if row and row.value is not None else default

    max_concurrent_tasks = int(await get_setting("max_concurrent_tasks", "3"))
    translation_threads = int(await get_setting("translation_threads", "4"))
    queue_monitor_interval = int(await get_setting("queue_monitor_interval", "5"))

    return PerformanceSettingsResponse(
        maxConcurrentTasks=max_concurrent_tasks,
        translationThreads=translation_threads,
        queueMonitorInterval=queue_monitor_interval
    )


@router.put("/performance")
async def update_performance_settings(
    request: UpdatePerformanceSettingsRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update performance configuration (admin only)"""
    settings_map: dict[str, str] = {}

    if request.maxConcurrentTasks is not None:
        settings_map["max_concurrent_tasks"] = str(request.maxConcurrentTasks)
    if request.translationThreads is not None:
        settings_map["translation_threads"] = str(request.translationThreads)
    if request.queueMonitorInterval is not None:
        settings_map["queue_monitor_interval"] = str(request.queueMonitorInterval)

    for key, value in settings_map.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(SystemSetting(key=key, value=value))

    await db.commit()

    # Notify TaskManager to reload configuration
    from ..websocket_manager import admin_ws_manager
    await admin_ws_manager.broadcast("settings.performance.updated", {})

    # Trigger TaskManager config reload
    from ..tasks import task_manager
    if task_manager:
        await task_manager.reload_config()

    return {"message": "Performance settings updated"}


@router.get("/performance/metrics", response_model=PerformanceMetricsResponse)
async def get_performance_metrics(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get current performance metrics (admin only)"""
    from ..tasks import task_manager
    from ..redis_client import redis_client

    # Get current configuration
    async def get_setting(key: str, default: str) -> str:
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        row = result.scalar_one_or_none()
        return row.value if row and row.value is not None else default

    max_concurrent_tasks = int(await get_setting("max_concurrent_tasks", "3"))
    translation_threads = int(await get_setting("translation_threads", "4"))
    queue_monitor_interval = int(await get_setting("queue_monitor_interval", "5"))

    current_config = PerformanceSettingsResponse(
        maxConcurrentTasks=max_concurrent_tasks,
        translationThreads=translation_threads,
        queueMonitorInterval=queue_monitor_interval
    )

    # Get queue lengths
    high_queue = await redis_client.get_queue_length("high")
    normal_queue = await redis_client.get_queue_length("normal")
    low_queue = await redis_client.get_queue_length("low")
    total_queued = high_queue + normal_queue + low_queue

    # Get active tasks count
    active_tasks = len(task_manager.active_tasks) if task_manager else 0

    return PerformanceMetricsResponse(
        activeTasks=active_tasks,
        queuedTasks=total_queued,
        highPriorityQueue=high_queue,
        normalPriorityQueue=normal_queue,
        lowPriorityQueue=low_queue,
        currentConfig=current_config
    )
