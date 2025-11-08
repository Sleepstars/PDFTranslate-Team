from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Role-based access control
    role: Mapped[str] = mapped_column(String(20), server_default="user")  # "admin" or "user"
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")

    # Quota management
    daily_page_limit: Mapped[int] = mapped_column(Integer, server_default="50")
    daily_page_used: Mapped[int] = mapped_column(Integer, server_default="0")
    last_quota_reset: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TranslationProviderConfig(Base):
    __tablename__ = "translation_provider_configs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    provider_type: Mapped[str] = mapped_column(String(50), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    is_default: Mapped[bool] = mapped_column(Boolean, server_default="false")
    settings: Mapped[str] = mapped_column(Text)  # JSON-encoded provider settings
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class UserProviderAccess(Base):
    __tablename__ = "user_provider_access"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider_config_id: Mapped[str] = mapped_column(String(50), ForeignKey("translation_provider_configs.id", ondelete="CASCADE"), index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TranslationTask(Base):
    __tablename__ = "translation_tasks"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(50), index=True)
    owner_email: Mapped[str] = mapped_column(String(255))
    document_name: Mapped[str] = mapped_column(String(500))
    source_lang: Mapped[str] = mapped_column(String(10))
    target_lang: Mapped[str] = mapped_column(String(10))
    engine: Mapped[str] = mapped_column(String(50))
    priority: Mapped[str] = mapped_column(String(20))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    input_s3_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_s3_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Quota tracking and provider association
    page_count: Mapped[int] = mapped_column(Integer, server_default="0")
    provider_config_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        ForeignKey("translation_provider_configs.id", ondelete="SET NULL"),
        nullable=True
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ownerId": self.owner_id,
            "ownerEmail": self.owner_email,
            "documentName": self.document_name,
            "sourceLang": self.source_lang,
            "targetLang": self.target_lang,
            "engine": self.engine,
            "priority": self.priority,
            "notes": self.notes,
            "status": self.status,
            "progress": self.progress,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "outputUrl": self.output_url,
            "error": self.error,
            "pageCount": self.page_count,
            "providerConfigId": self.provider_config_id,
        }


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
