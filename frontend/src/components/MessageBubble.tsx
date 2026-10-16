import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, RefreshCw, FileText, Film } from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

import type { MediaItem } from "../services/message";

interface Props {
  message: {
    sender: string;
    text: string;
    files?: string[];
    media?: MediaItem[];
  };
  streaming?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
}

function MessageBubble({
  message,
  streaming = false,
  canRegenerate = false,
  onRegenerate,
}: Props) {
  const isUser = message.sender === "user";
  const [copied, setCopied] = useState(false);

  // Don't draw an empty bubble while waiting for the first token
  if (!isUser && !message.text) return null;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`
          w-fit min-w-[110px] max-w-[88%] break-words rounded-3xl px-5 py-4 md:max-w-[75%]
          ${
            isUser
              ? "rounded-br-lg border border-[#40372F] bg-[#2B2623] text-[#F3EFEB]"
              : "min-w-0 rounded-bl-lg border border-[#2B2926] bg-[#1E1C1A] text-[#ECE8E4]"
          }
        `}
      >
        <div
          className={`
            mb-2 text-[11px] font-semibold uppercase tracking-[0.2em]
            ${isUser ? "text-[#FF8A4C]" : "text-[#8A837B]"}
          `}
        >
          {isUser ? "You" : "BRO"}
        </div>

        {/* Attached images / video */}
        {message.media && message.media.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {message.media.map((item, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl border border-[#4A4037]"
              >
                {item.preview ? (
                  <img
                    src={item.preview}
                    alt={item.name}
                    className="max-h-56 max-w-full object-cover"
                  />
                ) : (
                  <div className="px-3 py-2 text-xs">{item.name}</div>
                )}

                {item.kind === "video" && (
                  <span className="absolute bottom-2 left-2 flex max-w-[90%] items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[10px] text-white">
                    <Film size={12} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Attached documents */}
        {message.files && message.files.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {message.files.map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[#4A4037] bg-[#1E1C1A] px-3 py-1.5 text-xs text-[#ECE8E4]"
              >
                <FileText size={14} className="shrink-0 text-[#FF641F]" />
                <span className="max-w-[200px] truncate">{name}</span>
              </div>
            ))}
          </div>
        )}

        <div className={`md ${isUser ? "md-user" : ""}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const code = String(children).replace(/\n$/, "");

                if (!match) {
                  return (
                    <code
                      className="rounded-md bg-[#2A2623] px-1.5 py-1 text-sm text-orange-300"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                return <CodeBlock language={match[1]} code={code} />;
              },
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

        {/* Actions */}
        {!isUser && !streaming && (
          <div className="mt-3 flex items-center gap-1 text-[#8A837B]">
            <button
              onClick={copyMessage}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:bg-[#2A2623] hover:text-white"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>

            {canRegenerate && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:bg-[#2A2623] hover:text-white"
              >
                <RefreshCw size={14} />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface CodeProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-[#2B2926]">
      <div className="flex items-center justify-between bg-[#211E1C] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-orange-300">
          {language}
        </span>

        <button
          onClick={copyCode}
          className="text-xs text-[#A9A39D] transition hover:text-orange-300"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: "14px",
          background: "#181614",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default MessageBubble;