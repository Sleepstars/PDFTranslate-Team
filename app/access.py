from typing import Set, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    User,
    TranslationProviderConfig,
    GroupProviderAccess,
)


async def _active_provider_ids(db: AsyncSession) -> Set[str]:
    result = await db.execute(
        select(TranslationProviderConfig.id).where(TranslationProviderConfig.is_active == True)
    )
    return {row[0] for row in result.all()}


async def _active_mineru_provider_ids(db: AsyncSession) -> Set[str]:
    result = await db.execute(
        select(TranslationProviderConfig.id).where(
            TranslationProviderConfig.is_active == True,
            TranslationProviderConfig.provider_type == "mineru",
        )
    )
    return {row[0] for row in result.all()}


async def get_allowed_provider_ids(user: User, db: AsyncSession) -> Set[str]:
    """Compute allowed provider IDs for a user.

    Rules:
    - Admins can use all active providers.
    - If user is in a group, providers granted to that group are allowed.
    - If user has no group, no providers are allowed (empty set).
    """
    # Admins: all active providers
    if user.role == "admin":
        return await _active_provider_ids(db)

    # Group-based allowlist
    allowed: Set[str] = set()
    if getattr(user, "group_id", None):
        result = await db.execute(
            select(GroupProviderAccess.provider_config_id)
            .where(GroupProviderAccess.group_id == user.group_id)
        )
        allowed = {row[0] for row in result.all()}

    return allowed


async def assert_provider_access(
    user: User,
    provider_id: Optional[str],
    task_type: str,
    db: AsyncSession,
) -> TranslationProviderConfig:
    """Validate that a provider is allowed for user and task_type.

    Returns the provider config if valid; raises HTTP exceptions upstream if not.
    """
    from fastapi import HTTPException, status

    if not provider_id:
        # Optional for some task types; let caller decide if required
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="providerConfigId is required")

    result = await db.execute(
        select(TranslationProviderConfig).where(TranslationProviderConfig.id == provider_id)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider config not found")
    if not provider.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provider is inactive")

    # Validate category by task type
    if task_type == "parsing" and provider.provider_type != "mineru":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parsing tasks require a MinerU provider")
    if task_type in ("translation", "parse_and_translate") and provider.provider_type == "mineru":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Translation requires a non-MinerU provider")

    # Admins implicitly allowed
    if user.role == "admin":
        return provider

    allowed_ids = await get_allowed_provider_ids(user, db)
    if provider.id not in allowed_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provider not allowed for your account")

    return provider

