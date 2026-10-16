import { authFetch } from "./auth";

export interface Conversation {
  id: number;
  title: string;
  created_at?: string | null;
}

export interface Attachment {
  kind?: "doc" | "image" | "video";
  name: string;
  text: string;
  images?: string[];
  preview?: string;
  truncated?: boolean;
}

const VISION_HINTS = [
  "llava",
  "vision",
  "gemma3",
  "gemma4",
  "qwen3.5",
  "moondream",
  "minicpm-v",
  "bakllava",
  "qwen2.5vl",
  "qwen3-vl",
  "gpt-4o",
  "gpt-4.1",
  "gpt-5",
  "gemini",
  "claude",
  "llama-4",
  "pixtral",
];

export function isVisionModel(name: string): boolean {
  const n = name.toLowerCase();

  // the smallest gemma3 sizes are text-only
  if (n.startsWith("gemma3") && /:(1b|270m)/.test(n)) return false;

  return VISION_HINTS.some((hint) => n.includes(hint));
}

export async function getConversations(): Promise<Conversation[]> {
  const res = await authFetch("/conversations");
  if (!res.ok) return [];
  return res.json();
}

export async function getConversation(id: number) {
  const res = await authFetch(`/conversations/${id}`);
  if (!res.ok) return [];
  return res.json();
}

export async function deleteConversation(id: number) {
  const res = await authFetch(`/conversations/${id}`, {
    method: "DELETE",
  });

  return res.json();
}

export async function renameConversation(id: number, title: string) {
  const res = await authFetch(`/conversations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  return res.json();
}

export async function getModels(): Promise<string[]> {
  try {
    const res = await authFetch("/models");
    if (!res.ok) return [];

    const data = await res.json();
    return data.models ?? [];
  } catch {
    return [];
  }
}

export async function extractFile(file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);

  const res = await authFetch("/files/extract", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let detail = "Couldn't read this file.";

    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      // ignore
    }

    throw new Error(detail);
  }

  return res.json();
}