from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SessionResponse(BaseModel):
    user: Optional[dict]


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    isActive: bool
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
    role: Optional[Literal['admin', 'user']] = None
    isActive: Optional[bool] = None
    dailyPageLimit: Optional[int] = Field(default=None, ge=0)


class UpdateQuotaRequest(BaseModel):
    dailyPageLimit: int = Field(..., ge=0)


class ProviderConfigResponse(BaseModel):
    id: str
    name: str
    providerType: str
    description: Optional[str]
    isActive: bool
    isDefault: bool
    settings: dict
    createdAt: datetime
    updatedAt: datetime


class CreateProviderConfigRequest(BaseModel):
    name: str = Field(..., min_length=1)
    providerType: str = Field(..., min_length=1)
    description: Optional[str] = None
    isActive: bool = True
    isDefault: bool = False
    settings: dict = Field(default_factory=dict)


class UpdateProviderConfigRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    isActive: Optional[bool] = None
    isDefault: Optional[bool] = None
    settings: Optional[dict] = None


class UserProviderAccessResponse(BaseModel):
    id: str
    userId: str
    providerConfigId: str
    isDefault: bool
    createdAt: datetime


class GrantProviderAccessRequest(BaseModel):
    userId: str
    providerConfigId: str
    isDefault: bool = False


class CreateTaskRequest(BaseModel):
    documentName: str = Field(..., min_length=1)
    sourceLang: str = Field(..., min_length=1)
    targetLang: str = Field(..., min_length=1)
    engine: str = Field(..., min_length=1)
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
    error: Optional[str]
    pageCount: int
    providerConfigId: Optional[str]


class TasksEnvelope(BaseModel):
    tasks: list[TaskResponse]


class TaskEnvelope(BaseModel):
    task: TaskResponse
