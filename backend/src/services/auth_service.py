import hashlib
import hmac
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.database.db import get_db
from src.database.models import User

ALGORITHM = "HS256"
TOKEN_DAYS = 7

# ----------------------------------------------------
# Secret key: MUST be set (and kept private) on a real server
# ----------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "")

if not SECRET_KEY:
    if os.getenv("BRO_ENV") == "production":
        raise RuntimeError("SECRET_KEY must be set when BRO_ENV=production.")

    SECRET_KEY = "dev-only-secret-change-me-before-deploying-0123456789"
    print("WARNING: using the development SECRET_KEY. Set SECRET_KEY before deploying.")


# ----------------------------------------------------
# Passwords (scrypt, built into Python: no extra packages)
# ----------------------------------------------------
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = os.urandom(16)

    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        dklen=32,
        **_SCRYPT,
    )

    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")

        if scheme != "scrypt":
            return False

        expected = bytes.fromhex(digest_hex)

        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt_hex),
            dklen=len(expected),
            **_SCRYPT,
        )

        return hmac.compare_digest(actual, expected)

    except (ValueError, TypeError):
        return False


# Used so "unknown email" and "wrong password" take the same time
DUMMY_HASH = hash_password("not-a-real-password")


# ----------------------------------------------------
# Login tokens
# ----------------------------------------------------
def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=401,
        detail="Please log in again.",
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise unauthorized

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise unauthorized

    return user


# ----------------------------------------------------
# Simple in-memory rate limiting (per server process)
# ----------------------------------------------------
class RateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self.hits = defaultdict(deque)

    def check(self, key: str):
        now = time.monotonic()
        queue = self.hits[key]

        while queue and now - queue[0] > self.window:
            queue.popleft()

        if len(queue) >= self.limit:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
            )

        queue.append(now)


# 30 chat messages per 5 minutes per user
chat_limiter = RateLimiter(limit=30, window_seconds=300)

# 20 sign-up / log-in attempts per 5 minutes per IP address
ip_limiter = RateLimiter(limit=20, window_seconds=300)

# 10 log-in attempts per 10 minutes per email
login_limiter = RateLimiter(limit=10, window_seconds=600)
