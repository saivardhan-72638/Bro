from fastapi import FastAPI

from src.api.root import router

app = FastAPI(
    title="BRO API",
    version="0.1.0"
)

app.include_router(router)