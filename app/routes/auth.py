from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..auth import create_session, delete_session, get_token_from_request, authenticate_user
from ..config import PublicUser, get_settings
from ..dependencies import get_optional_user
from ..schemas import LoginRequest
from ..database import get_db

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
