import os
from datetime import datetime

from fastapi import APIRouter, Depends, Body, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.database.db import get_db
from src.schemas.chat import ChatRequest
from src.schemas.memory import MemoryCreate, MemoryUpdate

from src.database.models import Conversation, Message, User
from src.services.auth_service import get_current_user, chat_limiter
from src.services.chat_service import (
    stream_reply,
    list_models,
    SYSTEM_PROMPT,
)
from src.services.file_service import (
    extract_text,
    build_user_content,
    split_content,
    prepare_history_for_model,
    MAX_FILE_BYTES,
    MAX_FILE_CHARS,
)

from src.services.conversation_service import (
    create_conversation,
    save_message,
    build_chat_history,
    get_conversations,
    get_conversation,
    get_conversation_messages,
    update_conversation_title,
    delete_conversation,
)

from src.services.memory_service import (
    get_all_memories,
    get_memories_by_category,
    get_relevant_memories,
    format_memories_block,
    upsert_memory,
    update_memory,
    delete_memory,
)

from src.services.memory_extraction import extract_memories

router = APIRouter()

# Max messages one user can send per day (counted in the database)
DAILY_MESSAGE_LIMIT = int(os.getenv("DAILY_MESSAGE_LIMIT", "100"))


def messages_sent_today(db: Session, user_id: int) -> int:
    start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    return (
        db.query(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(
            Conversation.user_id == user_id,
            Message.role == "user",
            Message.created_at >= start,
        )
        .count()
    )


def build_system_prompt_with_memory(db: Session, user_id: int, query_text: str) -> str:
    relevant = get_relevant_memories(db, user_id, query_text)
    memory_block = format_memories_block(relevant)

    if not memory_block:
        return SYSTEM_PROMPT

    return f"{SYSTEM_PROMPT}\n\n{memory_block}"


def run_memory_extraction(
    db: Session,
    user_id: int,
    conversation_id: int,
    user_message: str,
    assistant_reply: str,
):
    """
    Best-effort: never let a memory extraction failure break the chat flow.
    """
    try:
        facts = extract_memories(user_message, assistant_reply)

        for fact in facts:
            upsert_memory(
                db=db,
                user_id=user_id,
                category=fact["category"],
                key=fact["key"],
                value=fact["value"],
                source_conversation_id=conversation_id,
            )
    except Exception as e:
        print("Memory extraction/storage failed:", e)


# ----------------------------------------------------
# Public: home + health + version
# ----------------------------------------------------
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


# ----------------------------------------------------
# Get this user's conversations
# ----------------------------------------------------
@router.get("/conversations")
def conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    items = get_conversations(db, user.id)

    return [
        {
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in items
    ]


# ----------------------------------------------------
# Get one conversation's messages
# ----------------------------------------------------
@router.get("/conversations/{conversation_id}")
def conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    messages = get_conversation_messages(db, conversation_id, user.id)

    if messages is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = []

    for m in messages:
        if m.role == "user":
            text, files, media = split_content(m.content)
            result.append(
                {"sender": "user", "text": text, "files": files, "media": media}
            )
        else:
            result.append({"sender": "bro", "text": m.content})

    return result


# ----------------------------------------------------
# Rename conversation
# ----------------------------------------------------
@router.put("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: int,
    title: str = Body(..., embed=True, max_length=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    conversation = update_conversation_title(
        db,
        conversation_id,
        title,
        user.id,
    )

    return {
        "success": conversation is not None,
    }


# ----------------------------------------------------
# Delete conversation
# ----------------------------------------------------
@router.delete("/conversations/{conversation_id}")
def remove_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    deleted = delete_conversation(db, conversation_id, user.id)

    if not deleted:
        return {
            "success": False,
            "message": "Conversation not found",
        }

    return {
        "success": True,
    }


# ----------------------------------------------------
# Models available
# ----------------------------------------------------
@router.get("/models")
def models(user: User = Depends(get_current_user)):
    return {"models": list_models()}


# ----------------------------------------------------
# Upload a document and extract its text
# ----------------------------------------------------
@router.post("/files/extract")
async def extract_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):

    data = await file.read()

    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File is too large (max 10 MB).")

    filename = file.filename or "file"

    try:
        text = extract_text(filename, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print("FILE EXTRACT ERROR:", e)
        raise HTTPException(status_code=400, detail="Couldn't read this file.")

    text = text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="No readable text found (scanned PDFs and images aren't supported yet).",
        )

    return {
        "name": filename,
        "text": text[:MAX_FILE_CHARS],
        "truncated": len(text) > MAX_FILE_CHARS,
    }


# ----------------------------------------------------
# Streaming Chat
# ----------------------------------------------------
@router.post("/chat/stream")
def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    chat_limiter.check(str(user.id))

    if not request.regenerate and messages_sent_today(db, user.id) >= DAILY_MESSAGE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"You've reached today's limit of {DAILY_MESSAGE_LIMIT} messages. Come back tomorrow!",
        )

    # Create conversation if needed, otherwise make sure it's this user's
    if request.conversation_id is None:
        conversation = create_conversation(db, user.id)
    else:
        conversation = get_conversation(db, request.conversation_id, user.id)

        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

    conversation_id = conversation.id

    if request.regenerate:
        # Drop the old answer, keep the user's question
        last = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.id.desc())
            .first()
        )

        if last is not None and last.role == "assistant":
            db.delete(last)
            db.commit()
    else:
        save_message(
            db=db,
            conversation_id=conversation_id,
            role="user",
            content=build_user_content(request.message, request.attachments),
        )

    if conversation.title == "New Chat":

        title = request.message.strip()

        if len(title) > 35:
            title = title[:35] + "..."

        update_conversation_title(
            db,
            conversation_id,
            title,
            user.id,
        )

    system_prompt = build_system_prompt_with_memory(db, user.id, request.message)

    history = build_chat_history(
        db=db,
        conversation_id=conversation_id,
        system_prompt=system_prompt,
    )

    history = prepare_history_for_model(history)

    def generate():

        full_reply = ""

        try:
            for chunk in stream_reply(history, request.model):

                full_reply += chunk
                yield chunk

        except Exception as e:
            print("LLM ERROR:", e)
            yield (
                "\u26a0\ufe0f BRO can't reach the AI model right now. "
                "Please try again in a moment."
            )
            return  # don't save the error as a real reply

        save_message(
            db=db,
            conversation_id=conversation_id,
            role="assistant",
            content=full_reply,
        )

        run_memory_extraction(
            db, user.id, conversation_id, request.message, full_reply
        )

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "X-Conversation-Id": str(conversation_id)
        },
    )


# ----------------------------------------------------
# Memory: list all (optionally filtered by category)
# ----------------------------------------------------
@router.get("/memories")
def list_memories(
    category: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if category:
        items = get_memories_by_category(db, user.id, category)
    else:
        items = get_all_memories(db, user.id)

    return [
        {
            "id": m.id,
            "category": m.category,
            "key": m.key,
            "value": m.value,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        }
        for m in items
    ]


# ----------------------------------------------------
# Memory: manually add one
# ----------------------------------------------------
@router.post("/memories")
def create_memory(
    memory: MemoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    saved = upsert_memory(
        db=db,
        user_id=user.id,
        category=memory.category,
        key=memory.key,
        value=memory.value,
    )

    return {
        "id": saved.id,
        "category": saved.category,
        "key": saved.key,
        "value": saved.value,
    }


# ----------------------------------------------------
# Memory: edit value
# ----------------------------------------------------
@router.put("/memories/{memory_id}")
def edit_memory(
    memory_id: int,
    memory: MemoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    updated = update_memory(db, user.id, memory_id, memory.value)

    if updated is None:
        raise HTTPException(status_code=404, detail="Memory not found")

    return {
        "id": updated.id,
        "category": updated.category,
        "key": updated.key,
        "value": updated.value,
    }


# ----------------------------------------------------
# Memory: delete
# ----------------------------------------------------
@router.delete("/memories/{memory_id}")
def remove_memory(
    memory_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deleted = delete_memory(db, user.id, memory_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")

    return {"success": True}
