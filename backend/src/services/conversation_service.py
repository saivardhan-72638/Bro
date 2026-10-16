from sqlalchemy.orm import Session

from src.database.models import Conversation, Memory, Message


def create_conversation(db: Session, user_id: int):

    conversation = Conversation(user_id=user_id)

    db.add(conversation)

    db.commit()

    db.refresh(conversation)

    return conversation


def save_message(
    db: Session,
    conversation_id: int,
    role: str,
    content: str,
):

    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
    )

    db.add(message)

    db.commit()

    db.refresh(message)

    return message


def get_messages(
    db: Session,
    conversation_id: int,
):
    return (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id
        )
        .order_by(Message.id)
        .all()
    )


def get_conversation(
    db: Session,
    conversation_id: int,
    user_id: int,
):
    """Returns the conversation only if it belongs to this user."""
    return (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
        .first()
    )


def build_chat_history(
    db: Session,
    conversation_id: int,
    system_prompt: str,
):
    messages = get_messages(db, conversation_id)

    history = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    for message in messages:
        history.append(
            {
                "role": message.role,
                "content": message.content,
            }
        )

    return history


def get_conversation_messages(
    db: Session,
    conversation_id: int,
    user_id: int,
):
    """Returns None if the conversation isn't this user's."""
    if get_conversation(db, conversation_id, user_id) is None:
        return None

    return get_messages(db, conversation_id)


def get_conversations(db: Session, user_id: int):
    return (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.id.desc())
        .all()
    )


def update_conversation_title(
    db: Session,
    conversation_id: int,
    title: str,
    user_id: int,
):
    conversation = get_conversation(db, conversation_id, user_id)

    if conversation is None:
        return None

    conversation.title = title

    db.commit()
    db.refresh(conversation)

    return conversation


def delete_conversation(
    db: Session,
    conversation_id: int,
    user_id: int,
):
    conversation = get_conversation(db, conversation_id, user_id)

    if conversation is None:
        return False

    # Memories only remember which chat they came from; keep them
    db.query(Memory).filter(
        Memory.source_conversation_id == conversation_id
    ).update({"source_conversation_id": None})

    db.delete(conversation)
    db.commit()

    return True
