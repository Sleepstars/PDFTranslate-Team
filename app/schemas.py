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


class CreateTaskRequest(BaseModel):
    documentName: str = Field(..., min_length=1)
    sourceLang: str = Field(..., min_length=1)
    targetLang: str = Field(..., min_length=1)
    engine: str = Field(..., min_length=1)
    priority: Literal['normal', 'high'] = 'normal'
    notes: Optional[str] = Field(default=None, max_length=500)


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


class TasksEnvelope(BaseModel):
    tasks: list[TaskResponse]


class TaskEnvelope(BaseModel):
    task: TaskResponse
