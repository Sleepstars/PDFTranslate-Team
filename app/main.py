from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .routes import auth, tasks, settings as settings_route, admin_users, admin_providers, users, admin_groups, admin_analytics
from .redis_client import redis_client
from .database import engine, Base
from .auth import create_user
from .database import AsyncSessionLocal
from sqlalchemy import select
from .models import User, Group
from .tasks import task_manager
import logging
import asyncio
from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting PDFTranslate backend...")

    try:
        logger.info("📡 Connecting to Redis...")
        await redis_client.connect()
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        raise

    # Run Alembic migrations before any DB usage to ensure schema exists
    try:
        logger.info("🗄️  Running database migrations (Alembic upgrade head)...")
        # 使用 subprocess 在独立进程中运行 Alembic，避免事件循环冲突
        import subprocess
        result = await asyncio.to_thread(
            subprocess.run,
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            check=True
        )
        logger.info("✅ Database migrations applied")
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Database migration failed: {e.stderr}")
        raise
    except Exception as e:
        logger.error(f"❌ Database migration failed: {e}")
        raise

    # Create default group and admin user if not exists
    try:
        logger.info("👤 Checking admin user...")
        async with AsyncSessionLocal() as db:
            # Ensure default group exists
            default_group = None
            try:
                result = await db.execute(select(Group).where(Group.name == "Default Group"))
                default_group = result.scalar_one_or_none()
                if not default_group:
                    default_group = Group(name="Default Group")
                    db.add(default_group)
                    await db.commit()
                    await db.refresh(default_group)
            except Exception:
                logger.exception("Failed to ensure default group exists")

            result = await db.execute(select(User).where(User.email == settings.admin_email))
            if not result.scalar_one_or_none():
                logger.info("Creating default admin user...")
                await create_user(
                    db,
                    settings.admin_email,
                    settings.admin_name,
                    settings.admin_password,
                    email_verified=True  # Admin users don't need email verification
                )
                logger.info("✅ Admin user created")
            else:
                logger.info("✅ Admin user exists")

            # Ensure admin is assigned to default group
            if default_group:
                result = await db.execute(select(User).where(User.email == settings.admin_email))
                admin_user = result.scalar_one_or_none()
                if admin_user and not getattr(admin_user, "group_id", None):
                    admin_user.group_id = default_group.id
                    await db.commit()
    except Exception as e:
        logger.error(f"❌ Admin user check/creation failed: {e}")
        # 不阻塞启动，继续运行

    # Resume tasks that were running before a crash/restart
    try:
        logger.info("🔄 Resuming stalled tasks...")
        # 添加超时保护，避免阻塞启动
        await asyncio.wait_for(task_manager.resume_stalled_tasks(), timeout=10.0)
        logger.info("✅ Stalled tasks resumed")
    except asyncio.TimeoutError:
        logger.warning("⚠️  Task resumption timed out (10s), continuing startup...")
    except Exception as e:
        logger.error(f"⚠️  Task resumption failed: {e}, continuing startup...")

    # Start queue monitor
    try:
        logger.info("📊 Starting task queue monitor...")
        await task_manager.start_queue_monitor()
        logger.info("✅ Queue monitor started")
    except Exception as e:
        logger.error(f"⚠️  Queue monitor failed to start: {e}")
        # 不阻塞启动，继续运行

    logger.info("🎉 Backend startup complete! Ready to accept requests.")

    yield

    # Shutdown
    logger.info("🛑 Shutting down backend...")
    try:
        await redis_client.disconnect()
        logger.info("✅ Redis disconnected")
    except Exception as e:
        logger.error(f"⚠️  Redis disconnect error: {e}")

app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(tasks.router, prefix=settings.api_prefix)
app.include_router(settings_route.router, prefix=settings.api_prefix)
app.include_router(admin_users.router)
app.include_router(admin_providers.router)
app.include_router(admin_groups.router)
app.include_router(admin_analytics.router)
app.include_router(users.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
