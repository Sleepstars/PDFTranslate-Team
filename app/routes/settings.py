from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import SystemSetting
from ..dependencies import get_current_user
from ..config import PublicUser

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings(
    user: PublicUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user.email != "admin@example.com":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    result = await db.execute(select(SystemSetting))
    settings = result.scalars().all()
    return {s.key: s.value for s in settings}


@router.put("")
async def update_settings(
    payload: dict,
    user: PublicUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user.email != "admin@example.com":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    for key, value in payload.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = str(value)
        else:
            db.add(SystemSetting(key=key, value=str(value)))

    await db.commit()
    return {"ok": True}
