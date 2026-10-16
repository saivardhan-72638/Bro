import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.database.db import get_db
from src.database.models import User
from src.services.auth_service import (
    DUMMY_HASH,
    create_token,
    get_current_user,
    hash_password,
    ip_limiter,
    login_limiter,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str
    password: str


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")

    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.client.host if request.client else "unknown"


def user_payload(user: User) -> dict:
    return {"id": user.id, "email": user.email}


@router.post("/register")
def register(
    data: Credentials,
    request: Request,
    db: Session = Depends(get_db),
):
    ip_limiter.check(client_ip(request))

    email = data.email.strip().lower()

    if len(email) > 254 or not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")

    if len(data.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters.",
        )

    if len(data.password) > 128:
        raise HTTPException(status_code=400, detail="Password is too long.")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    user = User(email=email, password_hash=hash_password(data.password))

    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    db.refresh(user)

    return {"token": create_token(user.id), "user": user_payload(user)}


@router.post("/login")
def login(
    data: Credentials,
    request: Request,
    db: Session = Depends(get_db),
):
    ip_limiter.check(client_ip(request))

    email = data.email.strip().lower()
    login_limiter.check(email)

    user = db.query(User).filter(User.email == email).first()

    stored = user.password_hash if user else DUMMY_HASH
    password_ok = verify_password(data.password, stored)

    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    return {"token": create_token(user.id), "user": user_payload(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_payload(user)
