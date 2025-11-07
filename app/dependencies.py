from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from .auth import get_session, get_token_from_request
from .config import PublicUser


async def get_optional_user(request: Request) -> Optional[PublicUser]:
    token = get_token_from_request(request)
    session = await get_session(token)
    return session


async def get_current_user(user: Optional[PublicUser] = Depends(get_optional_user)) -> PublicUser:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user
