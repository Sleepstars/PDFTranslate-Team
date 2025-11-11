from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.database import get_db
from app.dependencies import get_current_user_from_db
from app.models import User, TranslationProviderConfig, GroupProviderAccess
from app.schemas import UserResponse, SafeProviderConfigResponse
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


@router.get("/me/providers", response_model=List[SafeProviderConfigResponse])
async def get_user_providers(
    user: User = Depends(get_current_user_from_db),
    db: AsyncSession = Depends(get_db)
):
    """Get providers available to current user"""
    # Prefer group-based provider access if group is assigned
    response: list[SafeProviderConfigResponse] = []

    if getattr(user, "group_id", None):
        # Load group mapping with sort order
        result = await db.execute(
            select(GroupProviderAccess.provider_config_id, GroupProviderAccess.sort_order)
            .where(GroupProviderAccess.group_id == user.group_id)
        )
        mapping_rows = result.all()
        provider_order = {pid: sort for (pid, sort) in mapping_rows}
        provider_ids = list(provider_order.keys())

        if provider_ids:
            result = await db.execute(
                select(TranslationProviderConfig)
                .where(
                    TranslationProviderConfig.id.in_(provider_ids),
                    TranslationProviderConfig.is_active == True
                )
            )
            group_providers = result.scalars().all()

            # Sort by group's sort_order (then by created_at)
            group_providers.sort(key=lambda p: (provider_order.get(p.id, 0), p.created_at))

            # Determine defaults per category: first mineru, first non-mineru
            seen_mineru = False
            seen_translation = False

            for provider in group_providers:
                try:
                    settings_dict = json.loads(provider.settings or "{}")
                except json.JSONDecodeError:
                    settings_dict = {}

                is_default = False
                if provider.provider_type == "mineru" and not seen_mineru:
                    is_default = True
                    seen_mineru = True
                elif provider.provider_type != "mineru" and not seen_translation:
                    is_default = True
                    seen_translation = True

                response.append(
                    SafeProviderConfigResponse.from_provider(
                        provider, settings_dict, is_default
                    )
                )

            return response

    # No group assigned: return empty list (no providers available)
    return response
