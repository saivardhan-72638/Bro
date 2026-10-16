import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.database.db import engine
from src.database.models import Base

from src.api.root import router
from src.api.auth import router as auth_router

# Create all database tables
Base.metadata.create_all(bind=engine)

# Which websites may call this API (comma-separated list in production)
origins = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversation-Id"],
)

app.include_router(auth_router)
app.include_router(router)
