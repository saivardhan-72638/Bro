import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Code, Lightbulb, BookOpen, ListChecks } from "lucide-react";

import type { Message } from "../services/message";

import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

interface Props {
  messages: Message[];
  loading: boolean;
  onSend: (text: string) => void;
  onRegenerate: () => void;
}

const SUGGESTIONS = [
  {
    icon: Code,
    title: "Write code",
    prompt: "Write a Python script that renames all files in a folder by date.",
  },
  {
    icon: Lightbulb,
    title: "Project ideas",
    prompt: "Give me 5 beginner-friendly project ideas I can finish in a weekend.",
  },
  {
    icon: BookOpen,
    title: "Explain something",
    prompt: "Explain how APIs work like I'm a beginner.",
  },
  {
    icon: ListChecks,
    title: "Plan my day",
    prompt: "Help me plan a focused study schedule for today.",
  },
];

function ChatWindow({ messages, loading, onSend, onRegenerate }: Props) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chat = chatRef.current;
    if (!chat) return;

    const distanceFromBottom =
      chat.scrollHeight - chat.scrollTop - chat.clientHeight;

    const lastIsUser = messages[messages.length - 1]?.sender === "user";

    if (lastIsUser || distanceFromBottom < 150) {
      chat.scrollTop = chat.scrollHeight;
    }
  }, [messages, loading]);

  const showWelcome = messages.length === 0;

  const last = messages[messages.length - 1];
  const showTyping =
    loading && (!last || last.sender === "user" || last.text === "");

  return (
    <main ref={chatRef} className="flex-1 overflow-y-auto bg-[#121110]">
      {showWelcome ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex min-h-full items-center justify-center px-6 py-10"
        >
          <div className="w-full max-w-2xl text-center">
            <h1 className="text-6xl font-extrabold tracking-tight text-white md:text-7xl">
              BRO
            </h1>

            <h2 className="mt-6 text-2xl font-semibold text-white md:text-3xl">
              What are we getting done today?
            </h2>

            <p className="mt-4 text-lg leading-8 text-[#A9A39D]">
              Give BRO the task. Skip the preamble.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                <button
                  key={title}
                  onClick={() => onSend(prompt)}
                  className="
                    group rounded-2xl border border-[#2B2926] bg-[#1A1816]
                    p-5 text-left transition-all
                    hover:border-[#FF641F] hover:bg-[#211E1C]
                  "
                >
                  <Icon size={20} className="text-[#FF641F]" />

                  <p className="mt-3 font-semibold text-white">{title}</p>

                  <p className="mt-1 text-sm leading-6 text-[#A9A39D]">
                    {prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 md:px-8">
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;

            return (
              <MessageBubble
                key={index}
                message={message}
                streaming={isLast && loading}
                canRegenerate={isLast && !loading}
                onRegenerate={onRegenerate}
              />
            );
          })}

          {showTyping && <TypingIndicator />}
        </div>
      )}
    </main>
  );
}

export default ChatWindow;