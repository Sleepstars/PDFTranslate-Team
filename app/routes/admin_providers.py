from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import json

from app.database import get_db
from app.dependencies import require_admin
from app.models import User, TranslationProviderConfig
from app.schemas import (
    CreateProviderConfigRequest,
    UpdateProviderConfigRequest,
    ProviderConfigResponse,
    OpenAIProviderSettings,
    AzureOpenAIProviderSettings,
    DeepLProviderSettings,
    OllamaProviderSettings,
    TencentProviderSettings,
    GenericProviderSettings,
    MinerUProviderSettings,
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
        elif provider_type == "mineru":
            validated = MinerUProviderSettings(**settings)
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

    # Create new provider
    provider = TranslationProviderConfig(
        name=request.name,
        provider_type=request.providerType,
        description=request.description,
        is_active=request.isActive,
        is_default=False,
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
        settings=json.loads(provider.settings),
        createdAt=provider.created_at,
        updatedAt=provider.updated_at
    )

    await admin_ws_manager.broadcast("provider.created", response.model_dump())
    return response


@router.get("/{provider_id}", response_model=ProviderConfigResponse)
async def get_provider(
    provider_id: int,
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
    provider_id: int,
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

    # Update fields
    if request.name is not None:
        provider.name = request.name
    if request.description is not None:
        provider.description = request.description
    if request.isActive is not None:
        provider.is_active = request.isActive
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
        settings=json.loads(provider.settings),
        createdAt=provider.created_at,
        updatedAt=provider.updated_at
    )

    await admin_ws_manager.broadcast("provider.updated", response.model_dump())
    return response


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: int,
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
