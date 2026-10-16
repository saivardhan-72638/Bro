import { useEffect, useRef, useState } from "react";
import type { Message } from "../services/message";
import {
  getConversations,
  getConversation,
  deleteConversation,
  renameConversation,
  getModels,
  isVisionModel,
} from "../services/conversation";
import type { Conversation, Attachment } from "../services/conversation";
import { API_URL, authFetch } from "../services/auth";

const MODEL_KEY = "bro-model";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeConversationId, setActiveConversationId] =
    useState<number | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [models, setModels] = useState<string[]>([]);
  const [model, setModelState] = useState<string>(
    () => localStorage.getItem(MODEL_KEY) ?? ""
  );

  const [online, setOnline] = useState(true);

  const controllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<number | null>(null);

  const filteredConversations = conversations.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function refreshConversations() {
    try {
      const chats = await getConversations();
      setConversations(chats);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    refreshConversations();
  }, []);

  // Load installed Ollama models
  useEffect(() => {
    getModels().then((list) => {
      setModels(list);
      setModelState((current) =>
        current && list.includes(current) ? current : list[0] ?? ""
      );
    });
  }, []);

  // Backend online/offline indicator
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (!cancelled) setOnline(res.ok);
      } catch {
        if (!cancelled) setOnline(false);
      }
    }

    check();
    const timer = setInterval(check, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function setModel(value: string) {
    setModelState(value);
    localStorage.setItem(MODEL_KEY, value);
  }

  async function sendMessage(
    text: string,
    isRegenerate = false,
    attachments: Attachment[] = []
  ) {
    if (!text.trim() || loading) return;

    // Images / video frames need a vision model: switch automatically
    const hasImages = attachments.some((a) => (a.images?.length ?? 0) > 0);
    let modelToUse = model;

    if (hasImages && !isVisionModel(model)) {
      const visionModel = models.find(isVisionModel);

      if (visionModel) {
        modelToUse = visionModel;
        setModel(visionModel);
      }
    }

    setMessages((prev) => {
      if (isRegenerate) {
        const last = prev[prev.length - 1];
        return last?.sender === "bro" ? prev.slice(0, -1) : prev;
      }

      const userMessage: Message = {
        sender: "user",
        text,
        files: attachments
          .filter((a) => !(a.images && a.images.length))
          .map((a) => a.name),
        media: attachments
          .filter((a) => a.images && a.images.length)
          .map((a) => ({
            name: a.name,
            kind: a.kind ?? "image",
            preview: a.preview ?? "",
          })),
      };

      return [...prev, userMessage];
    });

    setLoading(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await authFetch("/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationIdRef.current,
          message: text,
          model: modelToUse || null,
          regenerate: isRegenerate,
          attachments: attachments.map((a) => ({
            name: a.name,
            text: a.text,
            kind: a.kind ?? "doc",
            images: a.images ?? [],
          })),
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        const data = await response.json().catch(() => null);

        throw new Error(
          `RATE_LIMIT:${data?.detail ?? "Too many requests. Please wait a moment."}`
        );
      }

      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status})`);
      }

      const id = response.headers.get("X-Conversation-Id");

      if (id) {
        const cid = Number(id);
        conversationIdRef.current = cid;
        setActiveConversationId(cid);
        refreshConversations();
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let reply = "";

      setMessages((prev) => [...prev, { sender: "bro", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        reply += decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { sender: "bro", text: reply };
          return copy;
        });
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";

      if (aborted) {
        // Stopped by the user: drop the bubble if nothing was written yet
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.sender === "bro" && last.text === ""
            ? prev.slice(0, -1)
            : prev;
        });
      } else {
        console.error(err);

        const limitMessage =
          err instanceof Error && err.message.startsWith("RATE_LIMIT:")
            ? err.message.slice("RATE_LIMIT:".length)
            : null;

        const errorMessage: Message = {
          sender: "bro",
          text: limitMessage
            ? `⏳ ${limitMessage}`
            : "⚠️ Couldn't reach BRO. Please check your connection and try again.",
        };

        setMessages((prev) => {
          const last = prev[prev.length - 1];

          if (last?.sender === "bro" && last.text === "") {
            return [...prev.slice(0, -1), errorMessage];
          }

          return [...prev, errorMessage];
        });
      }
    } finally {
      controllerRef.current = null;
      setLoading(false);
      refreshConversations();
    }
  }

  function regenerate() {
    const lastUser = [...messages].reverse().find((m) => m.sender === "user");

    if (lastUser) {
      sendMessage(lastUser.text, true);
    }
  }

  function stopGeneration() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
  }

  async function loadConversation(id: number) {
    controllerRef.current?.abort();

    const history = await getConversation(id);

    conversationIdRef.current = id;
    setActiveConversationId(id);
    setMessages(history);
  }

  function newChat() {
    controllerRef.current?.abort();

    conversationIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
  }

  async function removeConversation(id: number) {
    await deleteConversation(id);
    await refreshConversations();

    if (activeConversationId === id) {
      newChat();
    }
  }

  async function renameChat(id: number, title: string) {
    const clean = title.trim();
    if (!clean) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: clean } : c))
    );

    await renameConversation(id, clean);
    refreshConversations();
  }

  return {
    messages,
    loading,
    online,
    conversations,
    filteredConversations,
    searchQuery,
    setSearchQuery,
    activeConversationId,
    models,
    model,
    setModel,
    sendMessage,
    regenerate,
    stopGeneration,
    newChat,
    loadConversation,
    removeConversation,
    renameChat,
  };
}