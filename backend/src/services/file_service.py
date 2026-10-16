import io
import re
import zipfile
import xml.etree.ElementTree as ET

# ----------------------------------------------------
# Limits (keep documents small enough for the model's context window)
# ----------------------------------------------------
MAX_FILE_BYTES = 10 * 1024 * 1024   # 10 MB upload limit
MAX_FILE_CHARS = 12000              # characters kept per file
MAX_TOTAL_CHARS = 16000             # characters kept per message (all files)

TEXT_EXTENSIONS = {
    "txt", "md", "markdown", "csv", "tsv", "json", "xml", "yaml", "yml",
    "log", "ini", "toml", "env", "html", "htm", "css", "scss",
    "js", "jsx", "ts", "tsx", "py", "java", "c", "h", "cpp", "hpp", "cs",
    "go", "rs", "rb", "php", "sh", "bat", "ps1", "sql", "kt", "swift",
}

MAX_IMAGES = 8  # images / video frames kept per message

FILE_RE = re.compile(r'<<FILE name="(.*?)">>.*?<</FILE>>\n*', re.S)
IMG_RE = re.compile(r'<<IMG name="(.*?)" kind="(.*?)">>(.*?)<</IMG>>\n*', re.S)
BASE64_RE = re.compile(r"^[A-Za-z0-9+/=]+$")


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ValueError(
            "PDF support needs the 'pypdf' package. Run: pip install pypdf"
        )

    reader = PdfReader(io.BytesIO(data))
    pages = [(page.extract_text() or "") for page in reader.pages]
    return "\n\n".join(pages)


def _docx_text(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            xml = z.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError):
        raise ValueError("This .docx file looks damaged or is not a Word file.")

    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    root = ET.fromstring(xml)

    paragraphs = []

    for p in root.iter(ns + "p"):
        parts = []

        for node in p.iter():
            if node.tag == ns + "t" and node.text:
                parts.append(node.text)
            elif node.tag == ns + "tab":
                parts.append("\t")
            elif node.tag == ns + "br":
                parts.append("\n")

        paragraphs.append("".join(parts))

    return "\n".join(paragraphs)


def extract_text(filename: str, data: bytes) -> str:
    """Return the readable text inside an uploaded file."""
    ext = _extension(filename)

    if ext == "pdf":
        return _pdf_text(data)

    if ext == "docx":
        return _docx_text(data)

    if ext in TEXT_EXTENSIONS:
        return data.decode("utf-8", errors="replace")

    raise ValueError(
        f"'.{ext or 'unknown'}' files aren't supported yet. "
        "Try PDF, DOCX, TXT, MD, CSV, JSON or a code file."
    )


def _clean_name(name: str) -> str:
    return name.replace('"', "'").replace("\n", " ").strip() or "file"


def build_user_content(message: str, attachments) -> str:
    """Put attached documents / images in front of the user's message."""
    if not attachments:
        return message

    budget = MAX_TOTAL_CHARS
    image_budget = MAX_IMAGES
    blocks = []

    for a in attachments:
        name = _clean_name(a.name)

        # Images and video frames
        frames = [f for f in (a.images or []) if BASE64_RE.match(f)]

        if frames:
            frames = frames[:image_budget]
            image_budget -= len(frames)

            if frames:
                kind = "video" if a.kind == "video" else "image"
                blocks.append(
                    f'<<IMG name="{name}" kind="{kind}">>{",".join(frames)}<</IMG>>\n\n'
                )
            continue

        # Documents
        if budget <= 0 or not a.text:
            continue

        text = a.text[:budget]
        budget -= len(text)

        blocks.append(f'<<FILE name="{name}">>\n{text}\n<</FILE>>\n\n')

    return "".join(blocks) + message


def split_content(content: str):
    """
    Reverse of build_user_content.
    Returns (message text, [document names], [media previews]).
    """
    files = FILE_RE.findall(content)

    media = []

    for name, kind, data in IMG_RE.findall(content):
        first = data.split(",")[0] if data else ""
        media.append(
            {
                "name": name,
                "kind": kind,
                "preview": f"data:image/jpeg;base64,{first}" if first else "",
            }
        )

    text = IMG_RE.sub("", FILE_RE.sub("", content)).strip()

    return text, files, media


def prepare_history_for_model(history):
    """
    Turns stored <<IMG>> blocks into Ollama's `images` field.
    Only the most recent message with images is sent as real images;
    older ones become a short text note (keeps things fast).
    """
    last_with_images = None

    for i, m in enumerate(history):
        if m["role"] == "user" and IMG_RE.search(m["content"]):
            last_with_images = i

    prepared = []

    for i, m in enumerate(history):
        if m["role"] != "user" or not IMG_RE.search(m["content"]):
            prepared.append(m)
            continue

        images = []

        def replace(match, i=i, images=images):
            name, kind, data = match.group(1), match.group(2), match.group(3)
            frames = [f for f in data.split(",") if f]

            if i != last_with_images:
                return f'[Earlier attachment "{name}" - not shown again]\n\n'

            images.extend(frames)

            if kind == "video":
                return (
                    f'[Attached video "{name}": {len(frames)} frames '
                    "sampled evenly from it, in order]\n\n"
                )

            return f'[Attached image "{name}"]\n\n'

        content = IMG_RE.sub(replace, m["content"])

        item = {"role": "user", "content": content}

        if images:
            item["images"] = images

        prepared.append(item)

    return prepared