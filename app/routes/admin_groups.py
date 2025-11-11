from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.dependencies import require_admin
from app.models import Group, GroupProviderAccess, TranslationProviderConfig, User
from app.schemas import (
    GroupResponse,
    CreateGroupRequest,
    UpdateGroupRequest,
    MergeGroupsRequest,
    GroupProviderAccessResponse,
    GrantGroupProviderAccessRequest,
    ReorderGroupProvidersRequest,
)

router = APIRouter(prefix="/api/admin/groups", tags=["admin-groups"])


@router.get("", response_model=List[GroupResponse])
async def list_groups(
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).order_by(Group.created_at.desc()))
    groups = result.scalars().all()

    # Get statistics for each group
    group_responses = []
    for g in groups:
        # Count users in this group
        user_count_result = await db.execute(
            select(func.count(User.id)).where(User.group_id == g.id)
        )
        user_count = user_count_result.scalar() or 0

        # Count providers for this group
        provider_count_result = await db.execute(
            select(func.count(GroupProviderAccess.id)).where(GroupProviderAccess.group_id == g.id)
        )
        provider_count = provider_count_result.scalar() or 0

        group_responses.append(
            GroupResponse(
                id=g.id,
                name=g.name,
                createdAt=g.created_at,
                userCount=user_count,
                providerCount=provider_count,
            )
        )

    return group_responses


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    request: CreateGroupRequest,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    group = Group(name=request.name, created_at=datetime.utcnow())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return GroupResponse(
        id=group.id,
        name=group.name,
        createdAt=group.created_at,
        userCount=0,
        providerCount=0,
    )


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    request: UpdateGroupRequest,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Ensure group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Prevent renaming the default group
    if group.name == "default":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot rename the default group"
        )

    # Update the group name
    group.name = request.name
    await db.commit()
    await db.refresh(group)

    # Get statistics
    user_count_result = await db.execute(
        select(func.count(User.id)).where(User.group_id == group.id)
    )
    user_count = user_count_result.scalar() or 0

    provider_count_result = await db.execute(
        select(func.count(GroupProviderAccess.id)).where(GroupProviderAccess.group_id == group.id)
    )
    provider_count = provider_count_result.scalar() or 0

    return GroupResponse(
        id=group.id,
        name=group.name,
        createdAt=group.created_at,
        userCount=user_count,
        providerCount=provider_count,
    )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Ensure group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # Prevent deleting the default group
    if group.name == "default":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the default group"
        )

    # Check if group has users
    user_count_result = await db.execute(
        select(func.count(User.id)).where(User.group_id == group_id)
    )
    user_count = user_count_result.scalar() or 0

    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete group with {user_count} user(s). Please reassign users first."
        )

    # Delete the group (CASCADE will handle group_provider_access)
    await db.execute(delete(Group).where(Group.id == group_id))
    await db.commit()
    return None


@router.post("/{target_group_id}/merge", response_model=GroupResponse)
async def merge_groups(
    target_group_id: str,
    request: MergeGroupsRequest,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Ensure target group exists
    result = await db.execute(select(Group).where(Group.id == target_group_id))
    target_group = result.scalar_one_or_none()
    if not target_group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target group not found")

    # Validate source groups
    if target_group_id in request.sourceGroupIds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot merge a group into itself"
        )

    # Ensure all source groups exist and none is the default group
    source_groups = []
    for source_id in request.sourceGroupIds:
        result = await db.execute(select(Group).where(Group.id == source_id))
        source_group = result.scalar_one_or_none()
        if not source_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source group {source_id} not found"
            )
        if source_group.name == "default":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot merge the default group"
            )
        source_groups.append(source_group)

    # Begin merge transaction
    try:
        # 1. Reassign all users from source groups to target group
        for source_id in request.sourceGroupIds:
            await db.execute(
                update(User)
                .where(User.group_id == source_id)
                .values(group_id=target_group_id)
            )

        # 2. Merge provider access (union of providers, keep highest priority)
        # Get existing target group providers
        target_access_result = await db.execute(
            select(GroupProviderAccess).where(GroupProviderAccess.group_id == target_group_id)
        )
        target_providers = {acc.provider_config_id: acc for acc in target_access_result.scalars().all()}

        # Process each source group's providers
        for source_id in request.sourceGroupIds:
            source_access_result = await db.execute(
                select(GroupProviderAccess).where(GroupProviderAccess.group_id == source_id)
            )
            source_accesses = source_access_result.scalars().all()

            for source_access in source_accesses:
                provider_id = source_access.provider_config_id
                if provider_id in target_providers:
                    # Provider already exists in target, keep higher priority (lower sort_order)
                    existing = target_providers[provider_id]
                    if source_access.sort_order < existing.sort_order:
                        existing.sort_order = source_access.sort_order
                else:
                    # Add new provider to target group
                    new_access = GroupProviderAccess(
                        group_id=target_group_id,
                        provider_config_id=provider_id,
                        sort_order=source_access.sort_order,
                        created_at=datetime.utcnow(),
                    )
                    db.add(new_access)
                    target_providers[provider_id] = new_access

        # 3. Delete source groups (CASCADE will delete their group_provider_access)
        for source_id in request.sourceGroupIds:
            await db.execute(delete(Group).where(Group.id == source_id))

        await db.commit()

        # Get updated statistics
        user_count_result = await db.execute(
            select(func.count(User.id)).where(User.group_id == target_group_id)
        )
        user_count = user_count_result.scalar() or 0

        provider_count_result = await db.execute(
            select(func.count(GroupProviderAccess.id)).where(GroupProviderAccess.group_id == target_group_id)
        )
        provider_count = provider_count_result.scalar() or 0

        return GroupResponse(
            id=target_group.id,
            name=target_group.name,
            createdAt=target_group.created_at,
            userCount=user_count,
            providerCount=provider_count,
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to merge groups: {str(e)}"
        )


@router.get("/{group_id}/access", response_model=List[GroupProviderAccessResponse])
async def list_group_access(
    group_id: str,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # ensure group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    result = await db.execute(
        select(GroupProviderAccess).where(GroupProviderAccess.group_id == group_id)
    )
    mappings = result.scalars().all()
    # sort by sort_order then created_at
    mappings.sort(key=lambda m: (m.sort_order or 0, m.created_at))
    return [
        GroupProviderAccessResponse(
            id=m.id,
            groupId=m.group_id,
            providerConfigId=m.provider_config_id,
            sortOrder=m.sort_order or 0,
            createdAt=m.created_at,
        )
        for m in mappings
    ]


@router.post("/{group_id}/access", response_model=GroupProviderAccessResponse, status_code=status.HTTP_201_CREATED)
async def grant_group_access(
    group_id: str,
    request: GrantGroupProviderAccessRequest,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # ensure group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # ensure provider exists
    result = await db.execute(
        select(TranslationProviderConfig).where(TranslationProviderConfig.id == request.providerConfigId)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    # prevent duplicate
    result = await db.execute(
        select(GroupProviderAccess).where(
            GroupProviderAccess.group_id == group_id,
            GroupProviderAccess.provider_config_id == request.providerConfigId,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already granted")

    mapping = GroupProviderAccess(
        group_id=group_id,
        provider_config_id=request.providerConfigId,
        sort_order=request.sortOrder or 0,
        created_at=datetime.utcnow(),
    )
    db.add(mapping)
    await db.commit()
    await db.refresh(mapping)
    return GroupProviderAccessResponse(
        id=mapping.id,
        groupId=mapping.group_id,
        providerConfigId=mapping.provider_config_id,
        sortOrder=mapping.sort_order or 0,
        createdAt=mapping.created_at,
    )


@router.delete("/{group_id}/access/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_group_access(
    group_id: str,
    provider_id: str,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(GroupProviderAccess).where(
            GroupProviderAccess.group_id == group_id,
            GroupProviderAccess.provider_config_id == provider_id,
        )
    )
    await db.commit()
    return None


@router.post("/{group_id}/access/reorder")
async def reorder_group_access(
    group_id: str,
    request: ReorderGroupProvidersRequest,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # ensure group exists
    result = await db.execute(select(Group).where(Group.id == group_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    # update sort order by index
    order_map = {pid: idx for idx, pid in enumerate(request.providerIds)}
    result = await db.execute(
        select(GroupProviderAccess).where(GroupProviderAccess.group_id == group_id)
    )
    mappings = result.scalars().all()
    changed = False
    for m in mappings:
        new_order = order_map.get(m.provider_config_id)
        if new_order is not None and (m.sort_order or 0) != new_order:
            m.sort_order = new_order
            changed = True
    if changed:
        await db.commit()
    return {"ok": True}
