from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from contextlib import asynccontextmanager
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@asynccontextmanager
async def get_async_session_context():
    """Simple async context manager for scripts to acquire a session."""
    async with AsyncSessionLocal() as session:
        yield session
