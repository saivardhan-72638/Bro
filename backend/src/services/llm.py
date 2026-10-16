"""
One place that talks to the AI model.

LLM_PROVIDER=ollama (default)  -> your local Ollama (what you use today)
LLM_PROVIDER=openai            -> any OpenAI-compatible API (OpenRouter, Groq,
                                  OpenAI, Gemini, Together, ...) for a public site
"""

import json
import os

import httpx

PROVIDER = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip()
API_KEY = os.getenv("LLM_API_KEY", "").strip()

DEFAULT_MODEL = os.getenv("LLM_MODEL", "llama3.2").strip()
MEMORY_MODEL = os.getenv("LLM_MEMORY_MODEL", "").strip() or DEFAULT_MODEL

# Models users are allowed to pick (hosted mode). Comma-separated.
ALLOWED_MODELS = [
    m.strip() for m in os.getenv("LLM_MODELS", "").split(",") if m.strip()
]

MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "80000"))

# Ollama's default context is only 2048 tokens: too small for documents.
NUM_CTX = 8192


def is_hosted() -> bool:
    return PROVIDER == "openai"


if is_hosted() and not API_KEY:
    print("WARNING: LLM_PROVIDER=openai but LLM_API_KEY is empty.")


# ----------------------------------------------------
# Models
# ----------------------------------------------------
def list_models():
    if is_hosted():
        return ALLOWED_MODELS or [DEFAULT_MODEL]

    from ollama import list as ollama_list

    try:
        res = ollama_list()
        names = []

        for m in res["models"]:
            name = m.get("model") or m.get("name")

            if name and "embed" not in name:
                names.append(name)

        return names

    except Exception as e:
        print("OLLAMA LIST ERROR:", e)
        return []


def resolve_model(requested):
    """Users can only pick models the server allows."""
    if is_hosted():
        allowed = ALLOWED_MODELS or [DEFAULT_MODEL]
        return requested if requested in allowed else allowed[0]

    return requested or DEFAULT_MODEL


# ----------------------------------------------------
# Message format (our history -> OpenAI format, with images)
# ----------------------------------------------------
def to_openai_messages(messages):
    out = []

    for m in messages:
        images = m.get("images")

        if images:
            parts = [{"type": "text", "text": m["content"]}]

            for b64 in images:
                parts.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    }
                )

            out.append({"role": m["role"], "content": parts})
        else:
            out.append({"role": m["role"], "content": m["content"]})

    return out


def _headers():
    return {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }


def _url():
    return f"{BASE_URL.rstrip('/')}/chat/completions"


# ----------------------------------------------------
# Streaming chat
# ----------------------------------------------------
def stream_chat(messages, model=None):
    model = resolve_model(model)

    if is_hosted():
        yield from _stream_openai(messages, model)
    else:
        yield from _stream_ollama(messages, model)


def _stream_ollama(messages, model):
    from ollama import chat

    stream = chat(
        model=model,
        messages=messages,
        stream=True,
        options={"num_ctx": NUM_CTX},
    )

    for chunk in stream:
        yield chunk["message"]["content"]


def _stream_openai(messages, model):
    payload = {
        "model": model,
        "messages": to_openai_messages(messages),
        "stream": True,
        "max_tokens": MAX_TOKENS,
    }

    timeout = httpx.Timeout(120.0, connect=10.0)

    with httpx.stream(
        "POST", _url(), json=payload, headers=_headers(), timeout=timeout
    ) as response:

        if response.status_code != 200:
            body = response.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"LLM API error {response.status_code}: {body}")

        for line in response.iter_lines():
            if not line or not line.startswith("data:"):
                continue

            data = line[5:].strip()

            if data == "[DONE]":
                break

            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                continue

            choices = chunk.get("choices") or []

            if not choices:
                continue

            text = (choices[0].get("delta") or {}).get("content")

            if text:
                yield text


# ----------------------------------------------------
# One-shot completion (used for memory extraction)
# ----------------------------------------------------
def complete_chat(messages, model=None, temperature=None):
    model = model or DEFAULT_MODEL

    if is_hosted():
        payload = {
            "model": model,
            "messages": to_openai_messages(messages),
            "max_tokens": 400,
        }

        if temperature is not None:
            payload["temperature"] = temperature

        response = httpx.post(
            _url(),
            json=payload,
            headers=_headers(),
            timeout=httpx.Timeout(60.0, connect=10.0),
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"LLM API error {response.status_code}: {response.text[:300]}"
            )

        return response.json()["choices"][0]["message"]["content"] or ""

    from ollama import chat

    options = {"num_ctx": NUM_CTX}

    if temperature is not None:
        options["temperature"] = temperature

    response = chat(model=model, messages=messages, options=options)

    return response["message"]["content"]
