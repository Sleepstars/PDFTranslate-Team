from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional
from ..database import get_db
from ..models import SystemSetting, User
from ..dependencies import require_admin
from ..settings_manager import get_s3_config
from ..s3_client import S3Client

router = APIRouter(prefix="/admin/settings", tags=["settings"])


class S3ConfigRequest(BaseModel):
    endpoint: str = Field(default="", description="S3 endpoint URL (leave empty for AWS S3)")
    access_key: str = Field(..., min_length=1, description="S3 access key")
    secret_key: str = Field(..., min_length=1, description="S3 secret key")
    bucket: str = Field(..., min_length=1, description="S3 bucket name")
    region: str = Field(default="us-east-1", description="S3 region")
    ttl_days: int = Field(default=7, ge=1, le=365, description="File TTL in days")


class S3ConfigResponse(BaseModel):
    endpoint: str
    access_key: str
    bucket: str
    region: str
    ttl_days: int


@router.get("/s3", response_model=S3ConfigResponse)
async def get_s3_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get S3 configuration (admin only)"""
    config = await get_s3_config(db)
    return S3ConfigResponse(
        endpoint=config["endpoint"],
        access_key=config["access_key"][:4] + "****" if config["access_key"] else "",
        bucket=config["bucket"],
        region=config["region"],
        ttl_days=config["ttl_days"]
    )


@router.put("/s3")
async def update_s3_settings(
    request: S3ConfigRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update S3 configuration (admin only)"""
    settings_map = {
        "s3_endpoint": request.endpoint,
        "s3_access_key": request.access_key,
        "s3_secret_key": request.secret_key,
        "s3_bucket": request.bucket,
        "s3_region": request.region,
        "s3_file_ttl_days": str(request.ttl_days)
    }

    for key, value in settings_map.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = str(value)
        else:
            db.add(SystemSetting(key=key, value=str(value)))

    await db.commit()
    return {"message": "S3 configuration updated successfully"}


@router.post("/s3/test")
async def test_s3_connection(
    request: S3ConfigRequest,
    admin: User = Depends(require_admin)
):
    """Test S3 connection with provided credentials (admin only)"""
    try:
        config = {
            "endpoint": request.endpoint,
            "access_key": request.access_key,
            "secret_key": request.secret_key,
            "bucket": request.bucket,
            "region": request.region,
            "ttl_days": request.ttl_days
        }
        
        s3_client = S3Client(config)
        # Try to list objects to verify connection
        s3_client.s3.head_bucket(Bucket=request.bucket)
        
        return {"success": True, "message": "S3 connection successful"}
    except Exception as e:
        return {"success": False, "message": f"S3 connection failed: {str(e)}"}
