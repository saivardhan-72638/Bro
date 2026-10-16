"""
One-off cleanup script.

Deletes any conversation that has 2 or fewer messages (i.e. just a single
user + assistant exchange) — these are the fragmented conversations created
before the CORS fix, where every message started a brand new conversation.

Run from the backend/ folder:

    python cleanup_conversations.py

By default it does a DRY RUN (just prints what it would delete).
Pass --confirm to actually delete.

    python cleanup_conversations.py --confirm
"""

import sys
from sqlalchemy import func
from src.database.db import SessionLocal
from src.database.models import Conversation, Message


def main():
    confirm = "--confirm" in sys.argv

    db = SessionLocal()

    try:
        # Count messages per conversation
        counts = (
            db.query(
                Message.conversation_id,
                func.count(Message.id).label("msg_count"),
            )
            .group_by(Message.conversation_id)
            .all()
        )

        # conversation_id -> message count
        count_map = {row.conversation_id: row.msg_count for row in counts}

        conversations = db.query(Conversation).all()

        to_delete = [
            c for c in conversations
            if count_map.get(c.id, 0) <= 2
        ]

        if not to_delete:
            print("No fragmented conversations found. Nothing to do.")
            return

        print(f"Found {len(to_delete)} conversation(s) with <= 2 messages:\n")
        for c in to_delete:
            print(f"  id={c.id:<4} title={c.title!r:<30} messages={count_map.get(c.id, 0)}")

        if not confirm:
            print("\nDry run only — no changes made.")
            print("Re-run with --confirm to actually delete these conversations.")
            return

        for c in to_delete:
            db.delete(c)

        db.commit()
        print(f"\nDeleted {len(to_delete)} conversation(s).")

    finally:
        db.close()


if __name__ == "__main__":
    main()