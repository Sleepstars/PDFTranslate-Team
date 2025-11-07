from functools import lru_cache
from typing import List

from pydantic import BaseModel, EmailStr, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "PDFTranslate Backend"
    admin_email: EmailStr = "admin@example.com"
    admin_password: str = "changeme"
    admin_name: str = "PDF Admin"
    session_cookie_name: str = "pdftranslate_session"
    session_ttl_seconds: int = 60 * 60 * 12
    session_cookie_secure: bool = False
    api_prefix: str = "/api"
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pdftranslate"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # S3
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "pdftranslate"
    s3_region: str = "us-east-1"
    s3_file_ttl_days: int = 7

    # BabelDoc
    babeldoc_service: str = "google"
    babeldoc_lang_from: str = "en"
    babeldoc_lang_to: str = "zh"
    babeldoc_model: str = ""
    babeldoc_threads: int = 4

    # Custom Endpoints
    openai_api_base: str = ""
    deepl_api_url: str = ""
    ollama_host: str = ""
    azure_openai_endpoint: str = ""

    class Config:
        env_file = ".env.backend"
        env_prefix = "PDF_APP_"


class PublicUser(BaseModel):
    id: str
    name: str
    email: EmailStr


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_admin_user() -> PublicUser:
    settings = get_settings()
    return PublicUser(id=settings.admin_id, name=settings.admin_name, email=settings.admin_email)
