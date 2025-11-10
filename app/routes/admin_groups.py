from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.dependencies import require_admin
from app.models import Group, GroupProviderAccess, TranslationProviderConfig
from app.schemas import (
    GroupResponse,
    CreateGroupRequest,
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
    return [
        GroupResponse(id=g.id, name=g.name, createdAt=g.created_at) for g in groups
    ]


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    request: CreateGroupRequest,
    admin = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    group = Group(id=str(uuid.uuid4()), name=request.name, created_at=datetime.utcnow())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return GroupResponse(id=group.id, name=group.name, createdAt=group.created_at)


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
        id=str(uuid.uuid4()),
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
