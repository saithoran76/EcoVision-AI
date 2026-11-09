from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.core.config import settings

hasher = PasswordHasher()
ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    return hasher.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return hasher.verify(hashed, password)
    except VerifyMismatchError:
        return False

def create_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": subject, "iat": now, "exp": now + timedelta(hours=12)}, settings.secret_key, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
