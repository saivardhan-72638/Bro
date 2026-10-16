import json
import os
import re

from src.services.llm import complete_chat, MEMORY_MODEL

EXTRACTION_SYSTEM_PROMPT = """
You extract long-term memories from a single chat exchange.

Only extract facts that are clearly stated and worth remembering
long-term about the USER (not general knowledge, not the assistant).

Categories:
- profile: identity facts (name, age, location, job, etc.)
- preference: likes/dislikes, style, tools, communication preferences
- skill: things the user knows or is learning (languages, frameworks, etc.)
- project: things the user is building/working on

Rules:
- Return ONLY a JSON array, nothing else. No markdown, no explanation.
- Each item: {"category": "...", "key": "...", "value": "..."}
- "key" must be short and machine-friendly (lowercase, underscores), e.g. "name", "favorite_language", "current_project".
- If there is nothing worth remembering, return an empty array: []
- Never invent facts. Only extract what was explicitly said.
- Do not extract one-off questions, greetings, or small talk.

Example input:
User: my name is sai and i mainly code in python
Assistant: Nice to meet you, Sai!

Example output:
[{"category": "profile", "key": "name", "value": "Sai"}, {"category": "skill", "key": "primary_language", "value": "Python"}]
"""


def _extract_json_array(text: str):
    """
    Best-effort extraction of a JSON array from the model's raw output,
    in case it wraps it in markdown fences or adds stray text.
    """

    match = re.search(r"\[.*\]", text, re.DOTALL)

    if not match:
        return []

    try:
        data = json.loads(match.group(0))
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    return []


FIRST_PERSON = re.compile(
    r"\b(i|i'm|i\u2019m|im|i've|i\u2019ve|i'll|my|me|mine|myself|we|our)\b",
    re.IGNORECASE,
)


def should_extract(user_message: str) -> bool:
    """
    Skip the extra AI call for messages that can't contain facts about the
    user (saves time, and money on a hosted model).
    """
    if os.getenv("MEMORY_EXTRACTION", "on").strip().lower() == "off":
        return False

    text = user_message.strip()

    return len(text) >= 12 and bool(FIRST_PERSON.search(text))


def extract_memories(user_message: str, assistant_reply: str):
    """
    Runs a small, separate LLM call to pull out memorable facts from
    one exchange. Returns a list of dicts: {category, key, value}.
    Fails safe -> returns [] on any error so it never breaks the chat flow.
    """

    if not should_extract(user_message):
        return []

    prompt = (
        f"User: {user_message}\n"
        f"Assistant: {assistant_reply}\n\n"
        "Extract memories as a JSON array now."
    )

    try:
        raw = complete_chat(
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            model=MEMORY_MODEL,
            temperature=0,
        )

        items = _extract_json_array(raw)

        cleaned = []

        for item in items:
            if not isinstance(item, dict):
                continue

            category = str(item.get("category", "")).strip().lower()
            key = str(item.get("key", "")).strip().lower()
            value = str(item.get("value", "")).strip()

            if category and key and value:
                cleaned.append(
                    {
                        "category": category,
                        "key": key,
                        "value": value,
                    }
                )

        return cleaned

    except Exception as e:
        print("Memory extraction failed:", e)
        return []