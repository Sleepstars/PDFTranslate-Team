from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
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
from app.auth import hash_password, get_session
from app.websocket_manager import admin_ws_manager
from app.config import get_settings

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])
settings = get_settings()


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
            groupId=getattr(user, "group_id", None),
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

    response = UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        groupId=getattr(user, "group_id", None),
        isActive=user.is_active,
        dailyPageLimit=user.daily_page_limit,
        dailyPageUsed=user.daily_page_used,
        lastQuotaReset=user.last_quota_reset,
        createdAt=user.created_at
    )

    await admin_ws_manager.broadcast("user.created", response.model_dump())
    return response


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
        groupId=getattr(user, "group_id", None),
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
    if request.email is not None and request.email != user.email:
        # ensure email is unique
        existing = await db.execute(select(User).where(User.email == request.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        user.email = request.email
    if request.password is not None and request.password != "":
        user.password_hash = hash_password(request.password)
    if request.role is not None:
        user.role = request.role
    if request.groupId is not None:
        # group assignment is optional; ensure group exists or allow clearing
        if request.groupId == "":
            user.group_id = None
        else:
            from sqlalchemy import select
            from app.models import Group
            result = await db.execute(select(Group).where(Group.id == request.groupId))
            group = result.scalar_one_or_none()
            if not group:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
            user.group_id = request.groupId
    if request.isActive is not None:
        user.is_active = request.isActive
    if request.dailyPageLimit is not None:
        user.daily_page_limit = request.dailyPageLimit
    
    await db.commit()
    await db.refresh(user)

    response = UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        groupId=getattr(user, "group_id", None),
        isActive=user.is_active,
        dailyPageLimit=user.daily_page_limit,
        dailyPageUsed=user.daily_page_used,
        lastQuotaReset=user.last_quota_reset,
        createdAt=user.created_at
    )

    await admin_ws_manager.broadcast("user.updated", response.model_dump())
    return response


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
    await admin_ws_manager.broadcast("user.deleted", {"id": user_id})


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
        groupId=getattr(user, "group_id", None),
        isActive=user.is_active,
        dailyPageLimit=user.daily_page_limit,
        dailyPageUsed=user.daily_page_used,
        lastQuotaReset=user.last_quota_reset,
        createdAt=user.created_at
    )


@router.websocket("/ws")
async def user_updates(websocket: WebSocket):
    token = websocket.cookies.get(settings.session_cookie_name) or websocket.query_params.get("token")
    session = await get_session(token)
    if not session:
        await websocket.close(code=1008)
        return

    await admin_ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await admin_ws_manager.disconnect(websocket)
