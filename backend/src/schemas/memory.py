from pydantic import BaseModel


class MemoryCreate(BaseModel):
    category: str  # profile | preference | skill | project
    key: str
    value: str


class MemoryUpdate(BaseModel):
    value: str