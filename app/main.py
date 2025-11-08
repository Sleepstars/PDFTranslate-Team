from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .routes import auth, tasks, settings as settings_route, admin_users, admin_providers, users
from .redis_client import redis_client
from .database import engine, Base
from .auth import create_user
from .database import AsyncSessionLocal
from sqlalchemy import select
from .models import User

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await redis_client.connect()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create default admin user if not exists
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == settings.admin_email))
        if not result.scalar_one_or_none():
            await create_user(db, "admin", settings.admin_email, settings.admin_name, settings.admin_password)

    yield

    # Shutdown
    await redis_client.disconnect()

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
app.include_router(users.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
