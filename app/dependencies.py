from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import get_session, get_token_from_request
from .config import PublicUser
from .database import get_db
from .models import User


async def get_optional_user(request: Request) -> Optional[PublicUser]:
    token = get_token_from_request(request)
    session = await get_session(token)
    return session


async def get_current_user(user: Optional[PublicUser] = Depends(get_optional_user)) -> PublicUser:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user


async def get_current_user_from_db(
    current_user: PublicUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get full user object from database"""
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    return user


async def require_admin(user: User = Depends(get_current_user_from_db)) -> User:
    """Require user to have admin role"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user
