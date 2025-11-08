from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.dependencies import require_admin
from app.models import User
from app.schemas import (
    CreateUserRequest,
    UpdateUserRequest,
    UpdateQuotaRequest,
    UserResponse
)
from app.auth import hash_password

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all users (admin only)"""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            isActive=user.is_active,
            dailyPageLimit=user.daily_page_limit,
            dailyPageUsed=user.daily_page_used,
            lastQuotaReset=user.last_quota_reset,
            createdAt=user.created_at
        )
        for user in users
    ]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user (admin only)"""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        id=str(uuid.uuid4()),
        email=request.email,
        name=request.name,
        password_hash=hash_password(request.password),
        role=request.role,
        is_active=True,
        daily_page_limit=request.dailyPageLimit,
        daily_page_used=0,
        last_quota_reset=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        isActive=user.is_active,
        dailyPageLimit=user.daily_page_limit,
        dailyPageUsed=user.daily_page_used,
        lastQuotaReset=user.last_quota_reset,
        createdAt=user.created_at
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get user details (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        isActive=user.is_active,
        dailyPageLimit=user.daily_page_limit,
        dailyPageUsed=user.daily_page_used,
        lastQuotaReset=user.last_quota_reset,
        createdAt=user.created_at
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    if request.name is not None:
        user.name = request.name
    if request.role is not None:
        user.role = request.role
    if request.isActive is not None:
        user.is_active = request.isActive
    if request.dailyPageLimit is not None:
        user.daily_page_limit = request.dailyPageLimit
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        isActive=user.is_active,
        dailyPageLimit=user.daily_page_limit,
        dailyPageUsed=user.daily_page_used,
        lastQuotaReset=user.last_quota_reset,
        createdAt=user.created_at
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Deactivate user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-deletion
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    user.is_active = False
    await db.commit()


@router.patch("/{user_id}/quota", response_model=UserResponse)
async def update_user_quota(
    user_id: str,
    request: UpdateQuotaRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update user quota (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.daily_page_limit = request.dailyPageLimit
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        isActive=user.is_active,
        dailyPageLimit=user.daily_page_limit,
        dailyPageUsed=user.daily_page_used,
        lastQuotaReset=user.last_quota_reset,
        createdAt=user.created_at
    )

