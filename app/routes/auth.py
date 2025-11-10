from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..auth import create_session, delete_session, get_token_from_request, authenticate_user
from ..config import PublicUser, get_settings
from ..dependencies import get_optional_user
from ..schemas import LoginRequest, RegisterRequest
from ..database import get_db
from ..models import User, SystemSetting
from ..utils.altcha import create_challenge, verify_solution
from datetime import datetime, timezone
import bcrypt

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    user = await authenticate_user(db, payload.email, payload.password)

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    public_user = PublicUser(id=user.id, name=user.name, email=user.email, role=user.role)
    token = await create_session(public_user)

    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite='lax',
        secure=settings.session_cookie_secure,
        max_age=settings.session_ttl_seconds,
        path='/',
    )
    return {"user": public_user}


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = get_token_from_request(request)
    await delete_session(token)
    settings = get_settings()
    response.delete_cookie(
        settings.session_cookie_name,
        path='/',
        samesite='lax',
        secure=settings.session_cookie_secure,
    )
    return {"ok": True}


@router.get("/me")
async def me(user: Optional[PublicUser] = Depends(get_optional_user)):
    return {"user": user}


@router.get("/altcha/challenge")
async def get_altcha_challenge(db: AsyncSession = Depends(get_db)):
    """
    Generate an ALTCHA challenge for registration/login.
    """
    # Get ALTCHA settings
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "altcha_enabled"))
    enabled_setting = result.scalar_one_or_none()

    if not enabled_setting or enabled_setting.value.lower() not in ("true", "1"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ALTCHA is not enabled")

    # Get secret key
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "altcha_secret_key"))
    secret_setting = result.scalar_one_or_none()

    if not secret_setting or not secret_setting.value:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="ALTCHA is not configured properly")

    # Create challenge
    challenge_data = create_challenge(secret_setting.value)

    return challenge_data


@router.post("/register")
async def register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user account.
    """
    settings = get_settings()

    # Check if registration is allowed
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "allow_registration"))
    allow_reg_setting = result.scalar_one_or_none()

    if not allow_reg_setting or allow_reg_setting.value.lower() not in ("true", "1"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is not allowed")

    # Check ALTCHA if enabled
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "altcha_enabled"))
    altcha_enabled_setting = result.scalar_one_or_none()

    if altcha_enabled_setting and altcha_enabled_setting.value.lower() in ("true", "1"):
        if not payload.altchaPayload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ALTCHA verification required")

        # Get secret key
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == "altcha_secret_key"))
        secret_setting = result.scalar_one_or_none()

        if not secret_setting or not secret_setting.value:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="ALTCHA is not configured properly")

        # Verify ALTCHA solution
        if not verify_solution(payload.altchaPayload, secret_setting.value):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ALTCHA verification failed")

    # Check if email suffix is allowed
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "allowed_email_suffixes"))
    suffixes_setting = result.scalar_one_or_none()

    if suffixes_setting and suffixes_setting.value:
        allowed_suffixes = [s.strip() for s in suffixes_setting.value.split(",") if s.strip()]
        if allowed_suffixes:
            email_domain = payload.email.split("@")[1] if "@" in payload.email else ""
            if not any(email_domain.endswith(suffix) for suffix in allowed_suffixes):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email domain not allowed. Allowed domains: {', '.join(allowed_suffixes)}"
                )

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == payload.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Hash password
    password_hash = bcrypt.hashpw(payload.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Create new user
    new_user = User(
        email=payload.email,
        name=payload.name,
        password_hash=password_hash,
        role="user",
        is_active=True,
        daily_page_limit=50,
        daily_page_used=0,
        last_quota_reset=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc)
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Auto-login after registration
    public_user = PublicUser(id=new_user.id, name=new_user.name, email=new_user.email, role=new_user.role)
    token = await create_session(public_user)

    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite='lax',
        secure=settings.session_cookie_secure,
        max_age=settings.session_ttl_seconds,
        path='/',
    )

    return {"user": public_user, "message": "Registration successful"}
