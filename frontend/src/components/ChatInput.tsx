import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  SendHorizontal,
  Square,
  Paperclip,
  FileText,
  X,
  Loader2,
} from "lucide-react";

import { extractFile } from "../services/conversation";
import type { Attachment } from "../services/conversation";
import { imageToAttachment, videoToAttachment } from "../services/media";

interface Props {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  loading: boolean;
  visionAvailable: boolean;
}

const MAX_FILES = 4;

const ACCEPT =
  "image/*,video/*,.pdf,.docx,.txt,.md,.csv,.json,.xml,.yaml,.yml,.log,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sh,.sql";

function ChatInput({ onSend, onStop, loading, visionAvailable }: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Put the cursor back after BRO finishes replying
  useEffect(() => {
    if (!loading) textareaRef.current?.focus();
  }, [loading]);

  function resizeTextarea() {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 180) + "px";
  }

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;

    setError(null);

    const room = MAX_FILES - attachments.length - uploading;

    if (room <= 0) {
      setError(`You can attach up to ${MAX_FILES} files per message.`);
      return;
    }

    const accepted = files.slice(0, room);

    if (files.length > room) {
      setError(`Only ${MAX_FILES} files per message, extra files were skipped.`);
    }

    setUploading((n) => n + accepted.length);

    for (const file of accepted) {
      try {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if ((isImage || isVideo) && !visionAvailable) {
          throw new Error(
            "images and videos need a vision model. Run: ollama pull gemma3:4b, then refresh this page."
          );
        }

        const attachment = isImage
          ? await imageToAttachment(file)
          : isVideo
          ? await videoToAttachment(file)
          : await extractFile(file);

        setAttachments((prev) => [...prev, attachment]);
      } catch (err) {
        setError(
          `${file.name}: ${err instanceof Error ? err.message : "upload failed"}`
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const hasContent = input.trim().length > 0 || attachments.length > 0;
  const canSend = hasContent && uploading === 0 && !loading;

  function handleSend() {
    if (!canSend) return;

    const hasMedia = attachments.some((a) => a.images && a.images.length > 0);
    const hasDoc = attachments.some((a) => !(a.images && a.images.length > 0));

    const fallback =
      hasMedia && !hasDoc
        ? "Describe what you see in the attached file(s)."
        : "Please summarize the attached file(s).";

    onSend(input.trim() || fallback, attachments);

    setInput("");
    setAttachments([]);
    setError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "48px";
    }
  }

  return (
    <div className="border-t border-[#2B2926] bg-[#121110] px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto max-w-5xl">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!loading) addFiles(e.dataTransfer.files);
          }}
          className={`
            rounded-3xl border px-4 py-3 shadow-2xl
            transition-all duration-200
            focus-within:border-[#FF641F]
            ${
              dragging
                ? "border-[#FF641F] bg-[#241F1B]"
                : "border-[#2B2926] bg-[#1E1C1A]"
            }
          `}
        >
          {/* Attached files */}
          {(attachments.length > 0 || uploading > 0) && (
            <div className="mb-2 flex flex-wrap gap-2 px-1 pt-1">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-xl border border-[#3A3430] bg-[#262321] px-3 py-2 text-sm text-white"
                >
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <FileText size={16} className="shrink-0 text-[#FF641F]" />
                  )}

                  <span className="max-w-[160px] truncate">{file.name}</span>

                  {file.kind === "video" && (
                    <span className="text-[10px] uppercase text-[#A9A39D]">
                      {file.images?.length} frames
                    </span>
                  )}

                  {file.truncated && (
                    <span className="text-[10px] uppercase text-[#A9A39D]">
                      trimmed
                    </span>
                  )}

                  <button
                    onClick={() => removeAttachment(index)}
                    aria-label="Remove file"
                    className="text-[#A9A39D] transition hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {uploading > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-[#3A3430] bg-[#262321] px-3 py-2 text-sm text-[#A9A39D]">
                  <Loader2 size={16} className="animate-spin text-[#FF641F]" />
                  Reading file...
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || attachments.length + uploading >= MAX_FILES}
              aria-label="Attach a file"
              title="Attach a document, image or video"
              className="
                flex h-12 w-12 shrink-0 items-center justify-center
                rounded-full text-[#A9A39D] transition
                hover:bg-[#2A2623] hover:text-white
                disabled:cursor-not-allowed disabled:opacity-40
              "
            >
              <Paperclip size={20} />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              disabled={loading}
              placeholder="Ask BRO anything..."
              className="
                min-h-[48px] max-h-[180px] flex-1 resize-none
                overflow-y-auto bg-transparent py-3
                text-white placeholder:text-[#7F776F] outline-none
              "
              onChange={(e) => {
                setInput(e.target.value);
                resizeTextarea();
              }}
              onPaste={(e) => {
                if (e.clipboardData.files.length > 0) {
                  e.preventDefault();
                  addFiles(e.clipboardData.files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            {loading ? (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={onStop}
                aria-label="Stop generating"
                className="
                  flex h-12 w-12 shrink-0 items-center justify-center
                  rounded-full bg-red-500 text-white transition hover:bg-red-600
                "
              >
                <Square size={18} fill="white" />
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send message"
                className="
                  flex h-12 w-12 shrink-0 items-center justify-center
                  rounded-full bg-[#FF641F] text-white
                  shadow-lg shadow-orange-500/25 transition-all
                  hover:bg-[#FF7B3D]
                  disabled:cursor-not-allowed disabled:opacity-40
                "
              >
                <SendHorizontal size={18} />
              </motion.button>
            )}
          </div>
        </div>

        {error && <p className="mt-2 px-2 text-sm text-red-400">{error}</p>}

        <p className="mt-3 text-center text-xs text-[#6F6860]">
          Enter to send · Shift + Enter for a new line · Attach documents, images or video
        </p>
      </div>
    </div>
  );
}

export default ChatInput;