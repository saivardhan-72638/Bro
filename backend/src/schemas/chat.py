from typing import Annotated

from pydantic import BaseModel, Field


class Attachment(BaseModel):
    name: str = Field(max_length=200)
    text: str = Field(default="", max_length=30000)
    kind: str = Field(default="doc", max_length=10)
    images: list[Annotated[str, Field(max_length=3_000_000)]] = Field(
        default=[], max_length=8
    )


class ChatRequest(BaseModel):
    conversation_id: int | None = None
    message: str = Field(max_length=8000)
    model: str | None = Field(default=None, max_length=100)
    regenerate: bool = False
    attachments: list[Attachment] = Field(default=[], max_length=6)
