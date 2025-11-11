from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    altchaPayload: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    altchaPayload: Optional[str] = None


class SessionResponse(BaseModel):
    user: Optional[dict]


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    isActive: bool
    groupId: Optional[str] = None
    dailyPageLimit: int
    dailyPageUsed: int
    lastQuotaReset: datetime
    createdAt: datetime


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    role: Literal['admin', 'user'] = 'user'
    dailyPageLimit: int = Field(default=50, ge=0)


class UpdateUserRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    role: Optional[Literal['admin', 'user']] = None
    isActive: Optional[bool] = None
    dailyPageLimit: Optional[int] = Field(default=None, ge=0)
    groupId: Optional[str] = None


class UpdateQuotaRequest(BaseModel):
    dailyPageLimit: int = Field(..., ge=0)


class BaseProviderSettings(BaseModel):
    max_concurrency: Optional[int] = Field(default=4, ge=1, le=100)
    requests_per_minute: Optional[int] = Field(default=None, ge=1, le=10000)
    model: Optional[str] = None


class OpenAIProviderSettings(BaseProviderSettings):
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class AzureOpenAIProviderSettings(BaseProviderSettings):
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    deployment_name: Optional[str] = None


class DeepLProviderSettings(BaseProviderSettings):
    api_key: Optional[str] = None
    endpoint: Optional[str] = None


class OllamaProviderSettings(BaseProviderSettings):
    endpoint: Optional[str] = None


class TencentProviderSettings(BaseProviderSettings):
    secret_id: Optional[str] = None
    secret_key: Optional[str] = None


class GenericProviderSettings(BaseProviderSettings):
    api_key: Optional[str] = None
    endpoint: Optional[str] = None


class MinerUProviderSettings(BaseProviderSettings):
    api_token: Optional[str] = None
    model_version: str = Field(default="vlm")


class ProviderConfigResponse(BaseModel):
    id: str
    name: str
    providerType: str
    description: Optional[str]
    isActive: bool
    settings: dict
    createdAt: datetime
    updatedAt: datetime


class SafeProviderConfigResponse(BaseModel):
    """Provider config response with sensitive fields removed"""
    id: str
    name: str
    providerType: str
    description: Optional[str]
    isActive: bool
    isDefault: bool  # Dynamically computed based on priority
    settings: dict  # Sensitive fields will be filtered out before serialization
    createdAt: datetime
    updatedAt: datetime

    @staticmethod
    def from_provider(provider, settings_dict: dict, is_default: bool):
        """Create safe response by filtering sensitive fields from settings"""
        # Define sensitive fields to remove
        sensitive_fields = {
            'api_key', 'api_token', 'secret_key', 'secret_id',
            'password', 'token', 'apiKey', 'secretKey'
        }

        # Filter out sensitive fields
        safe_settings = {
            k: v for k, v in settings_dict.items()
            if k not in sensitive_fields
        }

        return SafeProviderConfigResponse(
            id=provider.id,
            name=provider.name,
            providerType=provider.provider_type,
            description=provider.description,
            isActive=provider.is_active,
            isDefault=is_default,
            settings=safe_settings,
            createdAt=provider.created_at,
            updatedAt=provider.updated_at
        )


class CreateProviderConfigRequest(BaseModel):
    name: str = Field(..., min_length=1)
    providerType: str = Field(..., min_length=1)
    description: Optional[str] = None
    isActive: bool = True
    settings: dict = Field(default_factory=dict)


class UpdateProviderConfigRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    isActive: Optional[bool] = None
    settings: Optional[dict] = None


class CreateTaskRequest(BaseModel):
    documentName: str = Field(..., min_length=1)
    taskType: Literal['translation', 'parsing', 'parse_and_translate'] = 'translation'
    sourceLang: Optional[str] = None  # Optional for parsing-only tasks
    targetLang: Optional[str] = None  # Optional for parsing-only tasks
    engine: Optional[str] = None  # Optional for parsing-only tasks
    priority: Literal['normal', 'high'] = 'normal'
    notes: Optional[str] = Field(default=None, max_length=500)
    providerConfigId: Optional[str] = None


class TaskActionRequest(BaseModel):
    action: Literal['retry', 'cancel']


class TaskResponse(BaseModel):
    id: str
    ownerId: str
    ownerEmail: EmailStr
    documentName: str
    sourceLang: str
    targetLang: str
    engine: str
    priority: Literal['normal', 'high']
    notes: Optional[str]
    status: str
    progress: int
    createdAt: datetime
    updatedAt: datetime
    completedAt: Optional[datetime]
    outputUrl: Optional[str]
    monoOutputUrl: Optional[str]
    dualOutputUrl: Optional[str]
    glossaryOutputUrl: Optional[str]
    zipOutputUrl: Optional[str]
    progressMessage: Optional[str]
    error: Optional[str]
    pageCount: int
    providerConfigId: Optional[str]
    taskType: str
    markdownOutputUrl: Optional[str]
    translatedMarkdownUrl: Optional[str]
    mineruTaskId: Optional[str]


class TasksEnvelope(BaseModel):
    tasks: list[TaskResponse]


class TaskEnvelope(BaseModel):
    task: TaskResponse


# Groups
class GroupResponse(BaseModel):
    id: str
    name: str
    createdAt: datetime


class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=1)


class GroupProviderAccessResponse(BaseModel):
    id: str
    groupId: str
    providerConfigId: str
    sortOrder: int
    createdAt: datetime


class GrantGroupProviderAccessRequest(BaseModel):
    providerConfigId: str
    sortOrder: int | None = None


class ReorderGroupProvidersRequest(BaseModel):
    providerIds: list[str]


# Admin Settings
class SystemSettingsResponse(BaseModel):
    allowRegistration: bool
    altchaEnabled: bool
    altchaSecretKey: Optional[str]
    allowedEmailSuffixes: list[str]


class UpdateSystemSettingsRequest(BaseModel):
    allowRegistration: Optional[bool] = None
    altchaEnabled: Optional[bool] = None
    altchaSecretKey: Optional[str] = None
    allowedEmailSuffixes: Optional[list[str]] = None


class EmailSettingsResponse(BaseModel):
    smtpHost: Optional[str]
    smtpPort: Optional[int]
    smtpUsername: Optional[str]
    smtpUseTLS: bool
    smtpFromEmail: Optional[EmailStr]
    allowedEmailSuffixes: list[str]


class UpdateEmailSettingsRequest(BaseModel):
    smtpHost: Optional[str] = None
    smtpPort: Optional[int] = Field(default=None, ge=1, le=65535)
    smtpUsername: Optional[str] = None
    smtpPassword: Optional[str] = Field(default=None, min_length=1)
    smtpUseTLS: Optional[bool] = None
    smtpFromEmail: Optional[EmailStr] = None
    allowedEmailSuffixes: Optional[list[str]] = None
