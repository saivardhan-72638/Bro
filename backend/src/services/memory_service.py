import re
from sqlalchemy.orm import Session
from src.database.models import Memory

VALID_CATEGORIES = {"profile", "preference", "skill", "project"}


def upsert_memory(
    db: Session,
    user_id: int,
    category: str,
    key: str,
    value: str,
    source_conversation_id: int | None = None,
):
    """
    Insert a new memory, or update the value if one with the same
    category+key already exists.
    """

    category = category.strip().lower()
    key = key.strip().lower()

    if category not in VALID_CATEGORIES:
        category = "profile"

    existing = (
        db.query(Memory)
        .filter(
            Memory.user_id == user_id,
            Memory.category == category,
            Memory.key == key,
        )
        .first()
    )

    if existing:
        existing.value = value
        if source_conversation_id is not None:
            existing.source_conversation_id = source_conversation_id
        db.commit()
        db.refresh(existing)
        return existing

    memory = Memory(
        user_id=user_id,
        category=category,
        key=key,
        value=value,
        source_conversation_id=source_conversation_id,
    )

    db.add(memory)
    db.commit()
    db.refresh(memory)

    return memory


def get_all_memories(db: Session, user_id: int):
    return (
        db.query(Memory)
        .filter(Memory.user_id == user_id)
        .order_by(Memory.category, Memory.key)
        .all()
    )


def get_memories_by_category(db: Session, user_id: int, category: str):
    return (
        db.query(Memory)
        .filter(Memory.user_id == user_id, Memory.category == category)
        .order_by(Memory.key)
        .all()
    )


def update_memory(db: Session, user_id: int, memory_id: int, value: str):
    memory = (
        db.query(Memory)
        .filter(Memory.id == memory_id, Memory.user_id == user_id)
        .first()
    )

    if memory is None:
        return None

    memory.value = value
    db.commit()
    db.refresh(memory)

    return memory


def delete_memory(db: Session, user_id: int, memory_id: int):
    memory = (
        db.query(Memory)
        .filter(Memory.id == memory_id, Memory.user_id == user_id)
        .first()
    )

    if memory is None:
        return False

    db.delete(memory)
    db.commit()

    return True


def _tokenize(text: str):
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def get_relevant_memories(db: Session, user_id: int, query_text: str, limit: int = 12):
    """
    Lightweight "smart retrieval" without embeddings: score every stored
    memory by keyword overlap with the current message, always keep
    profile memories (name, etc. should basically always be in context),
    and return the top N by score.
    """

    all_memories = get_all_memories(db, user_id)

    if not all_memories:
        return []

    query_tokens = _tokenize(query_text)

    scored = []

    for m in all_memories:
        mem_tokens = _tokenize(f"{m.key} {m.value}")
        overlap = len(query_tokens & mem_tokens)

        # profile facts (name, role, etc.) are cheap and almost always
        # useful, so give them a baseline boost
        base = 2 if m.category == "profile" else 0

        scored.append((overlap + base, m))

    scored.sort(key=lambda pair: pair[0], reverse=True)

    top = [m for score, m in scored[:limit] if score > 0]

    # Fallback: if nothing scored (e.g. first message ever, or no keyword
    # overlap), still surface profile facts so identity isn't lost.
    if not top:
        top = [m for m in all_memories if m.category == "profile"][:limit]

    return top


def format_memories_block(memories):
    if not memories:
        return ""

    grouped: dict[str, list[Memory]] = {}

    for m in memories:
        grouped.setdefault(m.category, []).append(m)

    lines = ["Known information about the user (use naturally, don't recite this list back verbatim):"]

    for category, items in grouped.items():
        lines.append(f"\n{category.title()}:")
        for m in items:
            lines.append(f"- {m.key}: {m.value}")

    return "\n".join(lines)