from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..auth import create_session, delete_session, get_token_from_request, authenticate_user, hash_password
from ..config import PublicUser, get_settings
from ..dependencies import get_optional_user
from ..schemas import LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest, ResendVerificationRequest
from ..database import get_db
from ..models import User, SystemSetting, PasswordResetToken, EmailVerificationToken
from ..utils.altcha import create_challenge, verify_solution
from datetime import datetime, timezone, timedelta
import sqlalchemy as sa
import hashlib
from secrets import token_urlsafe

RESET_TOKEN_TTL_MINUTES = 30
VERIFICATION_TOKEN_TTL_MINUTES = 30

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    # ALTCHA if enabled
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
        if not verify_solution(payload.altchaPayload, secret_setting.value):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ALTCHA verification failed")
    user = await authenticate_user(db, payload.email, payload.password)

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # Check if email is verified
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in. Check your inbox for the verification link."
        )

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

    # Hash password (Argon2)
    password_hash = hash_password(payload.password)

    # Create new user (email_verified=False by default)
    new_user = User(
        email=payload.email,
        name=payload.name,
        password_hash=password_hash,
        role="user",
        is_active=True,
        email_verified=False,
        daily_page_limit=50,
        daily_page_used=0,
        last_quota_reset=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc)
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Generate email verification token
    raw_token = token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_TOKEN_TTL_MINUTES)

    # Revoke existing unused tokens for this user (optional cleanup)
    await db.execute(
        sa.text(
            "UPDATE email_verification_tokens SET used = true WHERE user_id = :uid AND used = false"
        ),
        {"uid": new_user.id},
    )

    evt = EmailVerificationToken(
        id=token_urlsafe(12),
        user_id=new_user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False,
    )
    db.add(evt)
    await db.commit()

    # Build verification link
    try:
        origin = request.headers.get("Origin") or request.headers.get("Referer") or "http://localhost:3000"
        # crude parse base
        base = origin.split("/")
        base_url = f"{base[0]}//{base[2]}" if len(base) > 2 else origin
    except Exception:
        base_url = "http://localhost:3000"

    # Try to infer locale from referer path
    path = (request.headers.get("Referer") or "/").split(base_url)[-1]
    locale = path.split("/")[1] if len(path.split("/")) > 1 and path.split("/")[1] else "en"
    verification_url = f"{base_url}/{locale}/verify-email?token={raw_token}"

    # Send verification email
    from ..emailer import send_verification_email
    try:
        await send_verification_email(db, new_user.email, verification_url, new_user.name)
    except Exception:
        # If email fails, still allow registration but log the error
        # User can request resend later
        pass

    return {
        "message": "Registration successful. Please check your email to verify your account.",
        "email": new_user.email
    }


@router.post("/verify-email")
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify user's email address using the token sent via email.
    """
    # Hash the provided token
    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()

    # Find the token in database
    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    # Check if token is already used
    if token_record.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has already been used"
        )

    # Check if token is expired
    if token_record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new one."
        )

    # Find the user
    result = await db.execute(
        select(User).where(User.id == token_record.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if already verified
    if user.email_verified:
        return {"message": "Email already verified"}

    # Mark email as verified
    user.email_verified = True
    token_record.used = True

    await db.commit()

    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-verification")
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Resend email verification link to the user.
    """
    # Always return generic success to avoid account enumeration
    generic_ok = {"message": "If the email exists and is not verified, a verification link has been sent."}

    # Find user by email
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        return generic_ok

    # If already verified, return success but don't send email
    if user.email_verified:
        return generic_ok

    # Generate new verification token
    raw_token = token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_TOKEN_TTL_MINUTES)

    # Revoke existing unused tokens for this user
    await db.execute(
        sa.text(
            "UPDATE email_verification_tokens SET used = true WHERE user_id = :uid AND used = false"
        ),
        {"uid": user.id},
    )

    evt = EmailVerificationToken(
        id=token_urlsafe(12),
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False,
    )
    db.add(evt)
    await db.commit()

    # Build verification link
    try:
        origin = request.headers.get("Origin") or request.headers.get("Referer") or "http://localhost:3000"
        base = origin.split("/")
        base_url = f"{base[0]}//{base[2]}" if len(base) > 2 else origin
    except Exception:
        base_url = "http://localhost:3000"

    path = (request.headers.get("Referer") or "/").split(base_url)[-1]
    locale = path.split("/")[1] if len(path.split("/")) > 1 and path.split("/")[1] else "en"
    verification_url = f"{base_url}/{locale}/verify-email?token={raw_token}"

    # Send verification email
    from ..emailer import send_verification_email
    try:
        await send_verification_email(db, user.email, verification_url, user.name)
    except Exception:
        # Do not leak details; still return generic OK
        return generic_ok

    return generic_ok


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Always return generic success to avoid account enumeration
    generic_ok = {"message": "If the email exists, a reset link has been sent."}

    # ALTCHA if enabled
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "altcha_enabled"))
    altcha_enabled_setting = result.scalar_one_or_none()
    if altcha_enabled_setting and altcha_enabled_setting.value.lower() in ("true", "1"):
        if not payload.altchaPayload:
            return generic_ok
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == "altcha_secret_key"))
        secret_setting = result.scalar_one_or_none()
        if not secret_setting or not secret_setting.value:
            return generic_ok
        if not verify_solution(payload.altchaPayload, secret_setting.value):
            return generic_ok

    # Find user by email
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return generic_ok

    # Create token (single-use)
    raw_token = token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)

    # Revoke existing unused tokens for this user (optional cleanup)
    await db.execute(
        sa.text(
            "UPDATE password_reset_tokens SET used = true WHERE user_id = :uid AND used = false"
        ),
        {"uid": user.id},
    )

    prt = PasswordResetToken(
        id=token_urlsafe(12),
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False,
    )
    db.add(prt)
    await db.commit()

    # Build reset link
    try:
        origin = request.headers.get("Origin") or request.headers.get("Referer") or "http://localhost:3000"
        # crude parse base
        base = origin.split("/")
        base_url = f"{base[0]}//{base[2]}" if len(base) > 2 else origin
    except Exception:
        base_url = "http://localhost:3000"

    # Try to infer locale from referer path
    path = (request.headers.get("Referer") or "/").split(base_url)[-1]
    locale = path.split("/")[1] if len(path.split("/")) > 1 and path.split("/")[1] else "en"
    reset_url = f"{base_url}/{locale}/reset-password?token={raw_token}"

    # Send email
    from ..emailer import send_email
    subject = "Password reset request"
    text = f"Click the link to reset your password (valid {RESET_TOKEN_TTL_MINUTES} minutes):\n{reset_url}"
    try:
        await send_email(db, user.email, subject, text)
    except Exception:
        # Do not leak details; still return generic OK
        return generic_ok

    return generic_ok


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    # ALTCHA if enabled
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "altcha_enabled"))
    altcha_enabled_setting = result.scalar_one_or_none()
    if altcha_enabled_setting and altcha_enabled_setting.value.lower() in ("true", "1"):
        if not payload.altchaPayload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ALTCHA verification required")
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == "altcha_secret_key"))
        secret_setting = result.scalar_one_or_none()
        if not secret_setting or not secret_setting.value:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="ALTCHA is not configured properly")
        if not verify_solution(payload.altchaPayload, secret_setting.value):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ALTCHA verification failed")

    # Validate token
    if len(payload.newPassword) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password too short")

    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    result = await db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
    prt = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not prt or prt.used or prt.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    # Load user
    result = await db.execute(select(User).where(User.id == prt.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    # Update password using argon2 helper
    from ..auth import hash_password
    user.password_hash = hash_password(payload.newPassword)
    prt.used = True
    await db.commit()
    return {"message": "Password has been reset."}
