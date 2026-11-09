from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.security import decode_token
from app.db import users, db

bearer = HTTPBearer(auto_error=False)

async def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None:
        raise HTTPException(401, "Authentication required")
    payload = decode_token(credentials.credentials)
    email = payload.get("sub") if payload else None
    user = None
    if email and db is not None:
        user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    elif email:
        user = users.get(email)
        if user:
            user = {k:v for k,v in user.items() if k != "password_hash"}
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user
