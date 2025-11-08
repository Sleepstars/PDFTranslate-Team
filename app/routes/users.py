from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.database import get_db
from app.dependencies import get_current_user_from_db
from app.models import User, UserProviderAccess, TranslationProviderConfig
from app.schemas import UserResponse, ProviderConfigResponse
from app.quota import get_quota_status
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["users"])


class QuotaStatusResponse(BaseModel):
    dailyPageLimit: int
    dailyPageUsed: int
    remaining: int
    lastQuotaReset: str


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: User = Depends(get_current_user_from_db)
):
    """Get current user information"""
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


@router.get("/me/quota", response_model=QuotaStatusResponse)
async def get_user_quota(
    user: User = Depends(get_current_user_from_db),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's quota status"""
    quota = await get_quota_status(user.id, db)
    return QuotaStatusResponse(**quota)


@router.get("/me/providers", response_model=List[ProviderConfigResponse])
async def get_user_providers(
    user: User = Depends(get_current_user_from_db),
    db: AsyncSession = Depends(get_db)
):
    """Get providers available to current user"""
    # Get user's provider access
    result = await db.execute(
        select(UserProviderAccess)
        .where(UserProviderAccess.user_id == user.id)
    )
    accesses = result.scalars().all()
    
    if not accesses:
        return []
    
    # Get provider configs
    provider_ids = [access.provider_config_id for access in accesses]
    result = await db.execute(
        select(TranslationProviderConfig)
        .where(
            TranslationProviderConfig.id.in_(provider_ids),
            TranslationProviderConfig.is_active == True
        )
    )
    providers = result.scalars().all()
    
    # Create a map of default providers
    default_map = {access.provider_config_id: access.is_default for access in accesses}
    
    return [
        ProviderConfigResponse(
            id=provider.id,
            name=provider.name,
            providerType=provider.provider_type,
            description=provider.description,
            isActive=provider.is_active,
            isDefault=default_map.get(provider.id, False),
            settings=json.loads(provider.settings),
            createdAt=provider.created_at,
            updatedAt=provider.updated_at
        )
        for provider in providers
    ]

