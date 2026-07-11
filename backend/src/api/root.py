from fastapi import APIRouter
from src.schemas.chat import ChatRequest
from src.services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()

@router.get("/")
def root():
    return {
        "message": "Welcome to BRO 🚀"
    }


@router.get("/health")
def health():
    return {
        "status": "healthy"
    }


@router.get("/version")
def version():
    return {
        "version": "BRO Alpha 0.1"
    }


@router.post("/chat")
def chat(request: ChatRequest):

    reply = chat_service.generate_reply(request.message)

    return {
        "reply": reply
    }