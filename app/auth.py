from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Optional
from passlib.context import CryptContext
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .config import PublicUser, get_settings
from .models import User
from .redis_client import get_redis
import json
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash

# Use argon2 directly instead of passlib to avoid bcrypt compatibility issues
ph = PasswordHasher()

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        ph.verify(hashed_password, plain_password)
        return True
    except (VerifyMismatchError, InvalidHash):
        return False

async def create_session(user: PublicUser) -> str:
    settings = get_settings()
    redis = await get_redis()
    token = token_urlsafe(32)
    session_data = {"id": user.id, "name": user.name, "email": user.email}
    await redis.redis.setex(f"session:{token}", settings.session_ttl_seconds, json.dumps(session_data))
    return token

async def get_session(token: Optional[str]) -> Optional[PublicUser]:
    if not token:
        return None
    redis = await get_redis()
    session_data = await redis.redis.get(f"session:{token}")
    if not session_data:
        return None
    data = json.loads(session_data)
    return PublicUser(**data)

async def delete_session(token: Optional[str]) -> None:
    if not token:
        return
    redis = await get_redis()
    await redis.redis.delete(f"session:{token}")

def get_token_from_request(request: Request) -> Optional[str]:
    settings = get_settings()
    return request.cookies.get(settings.session_cookie_name)

async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user

async def create_user(db: AsyncSession, user_id: str, email: str, name: str, password: str) -> User:
    user = User(id=user_id, email=email, name=name, password_hash=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
