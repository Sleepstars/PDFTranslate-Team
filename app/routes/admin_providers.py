from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import json

from app.database import get_db
from app.dependencies import require_admin
from app.models import User, TranslationProviderConfig, UserProviderAccess
from app.schemas import (
    CreateProviderConfigRequest,
    UpdateProviderConfigRequest,
    ProviderConfigResponse,
    UserProviderAccessResponse,
    GrantProviderAccessRequest,
    OpenAIProviderSettings,
    AzureOpenAIProviderSettings,
    DeepLProviderSettings,
    OllamaProviderSettings,
    TencentProviderSettings,
    GenericProviderSettings,
)
from app.websocket_manager import admin_ws_manager
from app.auth import get_session
from app.config import get_settings

router = APIRouter(prefix="/api/admin/providers", tags=["admin-providers"])
settings = get_settings()


@router.get("", response_model=List[ProviderConfigResponse])
async def list_providers(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all provider configs (admin only)"""
    result = await db.execute(
        select(TranslationProviderConfig).order_by(TranslationProviderConfig.created_at.desc())
    )
    providers = result.scalars().all()
    
    return [
        ProviderConfigResponse(
            id=provider.id,
            name=provider.name,
            providerType=provider.provider_type,
            description=provider.description,
            isActive=provider.is_active,
            isDefault=provider.is_default,
            settings=json.loads(provider.settings),
            createdAt=provider.created_at,
            updatedAt=provider.updated_at
        )
        for provider in providers
    ]


def validate_provider_settings(provider_type: str, settings: dict) -> dict:
    """Validate provider settings based on provider type"""
    try:
        if provider_type == "openai":
            validated = OpenAIProviderSettings(**settings)
        elif provider_type == "azure_openai":
            validated = AzureOpenAIProviderSettings(**settings)
        elif provider_type == "deepl":
            validated = DeepLProviderSettings(**settings)
        elif provider_type == "ollama":
            validated = OllamaProviderSettings(**settings)
        elif provider_type == "tencent":
            validated = TencentProviderSettings(**settings)
        elif provider_type in ["gemini", "deepseek", "zhipu", "siliconflow", "grok", "groq"]:
            validated = GenericProviderSettings(**settings)
        else:
            validated = GenericProviderSettings(**settings)
        
        return validated.model_dump(exclude_none=True)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid settings for provider type {provider_type}: {str(e)}"
        )


@router.post("", response_model=ProviderConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    request: CreateProviderConfigRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new provider config (admin only)"""
    # Validate settings
    validated_settings = validate_provider_settings(request.providerType, request.settings)
    
    # If setting as default, unset other defaults
    if request.isDefault:
        result = await db.execute(
            select(TranslationProviderConfig).where(
                TranslationProviderConfig.is_default == True
            )
        )
        for provider in result.scalars().all():
            provider.is_default = False
    
    # Create new provider
    provider = TranslationProviderConfig(
        id=str(uuid.uuid4()),
        name=request.name,
        provider_type=request.providerType,
        description=request.description,
        is_active=request.isActive,
        is_default=request.isDefault,
        settings=json.dumps(validated_settings),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(provider)
    await db.commit()
    await db.refresh(provider)

    response = ProviderConfigResponse(
        id=provider.id,
        name=provider.name,
        providerType=provider.provider_type,
        description=provider.description,
        isActive=provider.is_active,
        isDefault=provider.is_default,
        settings=json.loads(provider.settings),
        createdAt=provider.created_at,
        updatedAt=provider.updated_at
    )

    await admin_ws_manager.broadcast("provider.created", response.model_dump())
    return response


@router.get("/{provider_id}", response_model=ProviderConfigResponse)
async def get_provider(
    provider_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get provider config details (admin only)"""
    result = await db.execute(
        select(TranslationProviderConfig).where(TranslationProviderConfig.id == provider_id)
    )
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider config not found"
        )
    
    return ProviderConfigResponse(
        id=provider.id,
        name=provider.name,
        providerType=provider.provider_type,
        description=provider.description,
        isActive=provider.is_active,
        isDefault=provider.is_default,
        settings=json.loads(provider.settings),
        createdAt=provider.created_at,
        updatedAt=provider.updated_at
    )


@router.patch("/{provider_id}", response_model=ProviderConfigResponse)
async def update_provider(
    provider_id: str,
    request: UpdateProviderConfigRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update provider config (admin only)"""
    result = await db.execute(
        select(TranslationProviderConfig).where(TranslationProviderConfig.id == provider_id)
    )
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider config not found"
        )
    
    # If setting as default, unset other defaults
    if request.isDefault and not provider.is_default:
        result = await db.execute(
            select(TranslationProviderConfig).where(
                TranslationProviderConfig.is_default == True
            )
        )
        for other_provider in result.scalars().all():
            other_provider.is_default = False
    
    # Update fields
    if request.name is not None:
        provider.name = request.name
    if request.description is not None:
        provider.description = request.description
    if request.isActive is not None:
        provider.is_active = request.isActive
    if request.isDefault is not None:
        provider.is_default = request.isDefault
    if request.settings is not None:
        validated_settings = validate_provider_settings(provider.provider_type, request.settings)
        provider.settings = json.dumps(validated_settings)
    
    provider.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(provider)

    response = ProviderConfigResponse(
        id=provider.id,
        name=provider.name,
        providerType=provider.provider_type,
        description=provider.description,
        isActive=provider.is_active,
        isDefault=provider.is_default,
        settings=json.loads(provider.settings),
        createdAt=provider.created_at,
        updatedAt=provider.updated_at
    )

    await admin_ws_manager.broadcast("provider.updated", response.model_dump())
    return response


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete provider config (admin only)"""
    result = await db.execute(
        select(TranslationProviderConfig).where(TranslationProviderConfig.id == provider_id)
    )
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider config not found"
        )

    await db.delete(provider)
    await db.commit()
    await admin_ws_manager.broadcast("provider.deleted", {"id": provider_id})


@router.get("/access/all", response_model=List[UserProviderAccessResponse])
async def list_all_access(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all user-provider access mappings (admin only)"""
    result = await db.execute(
        select(UserProviderAccess).order_by(UserProviderAccess.created_at.desc())
    )
    accesses = result.scalars().all()
    
    return [
        UserProviderAccessResponse(
            id=access.id,
            userId=access.user_id,
            providerConfigId=access.provider_config_id,
            isDefault=access.is_default,
            createdAt=access.created_at
        )
        for access in accesses
    ]


@router.post("/access", response_model=UserProviderAccessResponse, status_code=status.HTTP_201_CREATED)
async def grant_provider_access(
    request: GrantProviderAccessRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Grant user access to a provider (admin only)"""
    # Check if user exists
    user_result = await db.execute(select(User).where(User.id == request.userId))
    if not user_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if provider exists
    provider_result = await db.execute(
        select(TranslationProviderConfig).where(TranslationProviderConfig.id == request.providerConfigId)
    )
    if not provider_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider config not found"
        )
    
    # Check if access already exists
    existing_result = await db.execute(
        select(UserProviderAccess).where(
            UserProviderAccess.user_id == request.userId,
            UserProviderAccess.provider_config_id == request.providerConfigId
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access already granted"
        )
    
    # If setting as default, unset other defaults for this user
    if request.isDefault:
        result = await db.execute(
            select(UserProviderAccess).where(
                UserProviderAccess.user_id == request.userId,
                UserProviderAccess.is_default == True
            )
        )
        for access in result.scalars().all():
            access.is_default = False
    
    # Create access
    access = UserProviderAccess(
        id=str(uuid.uuid4()),
        user_id=request.userId,
        provider_config_id=request.providerConfigId,
        is_default=request.isDefault,
        created_at=datetime.utcnow()
    )
    
    db.add(access)
    await db.commit()
    await db.refresh(access)
    
    return UserProviderAccessResponse(
        id=access.id,
        userId=access.user_id,
        providerConfigId=access.provider_config_id,
        isDefault=access.is_default,
        createdAt=access.created_at
    )


@router.delete("/access/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_provider_access(
    access_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Revoke user access to a provider (admin only)"""
    result = await db.execute(
        select(UserProviderAccess).where(UserProviderAccess.id == access_id)
    )
    access = result.scalar_one_or_none()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access not found"
        )
    
    await db.delete(access)
    await db.commit()


@router.websocket("/ws")
async def provider_updates(websocket: WebSocket):
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
