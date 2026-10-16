import { useRef, useState } from "react";
import { Search, Plus, Trash2, Pencil, X, LogOut } from "lucide-react";
import type { Conversation } from "../services/conversation";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: number | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onNewChat: () => void;
  onConversationSelect: (id: number) => void;
  onDeleteConversation: (id: number) => void;
  onRenameConversation: (id: number, title: string) => void;
  open: boolean;
  onClose: () => void;
  userEmail: string;
  onLogout: () => void;
}

const DAY = 86400000;

function groupLabel(createdAt?: string | null): string {
  if (!createdAt) return "History";

  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(createdAt);
  const date = new Date(hasZone ? createdAt : createdAt + "Z");

  if (Number.isNaN(date.getTime())) return "History";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const t = date.getTime();
  const today = startOfToday.getTime();

  if (t >= today) return "Today";
  if (t >= today - DAY) return "Yesterday";
  if (t >= today - 7 * DAY) return "Previous 7 days";
  if (t >= today - 30 * DAY) return "Previous 30 days";
  return "Older";
}

export default function Sidebar({
  conversations,
  activeConversationId,
  searchQuery,
  setSearchQuery,
  onNewChat,
  onConversationSelect,
  onDeleteConversation,
  onRenameConversation,
  open,
  onClose,
  userEmail,
  onLogout,
}: SidebarProps)  {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const cancelledRef = useRef(false);

  function startEdit(chat: Conversation) {
    cancelledRef.current = false;
    setEditingId(chat.id);
    setDraft(chat.title);
  }

  function commitEdit() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }

    if (editingId !== null && draft.trim()) {
      onRenameConversation(editingId, draft.trim());
    }

    setEditingId(null);
  }

  // Group chats (list is already newest-first)
  const groups = new Map<string, Conversation[]>();

  for (const chat of conversations) {
    const label = groupLabel(chat.created_at);
    const list = groups.get(label) ?? [];
    list.push(chat);
    groups.set(label, list);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40
          flex h-dvh w-72 shrink-0 flex-col
          border-r border-[#2B2926] bg-[#181614]
          transition-transform duration-300
          md:static md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex items-start justify-between px-6 pt-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              BRO
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#A9A39D]">
              Less overthinking.
              <br />
              More doing.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1 text-[#A9A39D] hover:text-white md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* New Chat */}
        <div className="mt-8 px-6">
          <button
            onClick={onNewChat}
            className="
              flex w-full items-center justify-center gap-2
              rounded-2xl bg-[#FF641F] py-3.5
              font-semibold text-white
              shadow-lg shadow-orange-500/20
              transition hover:bg-[#FF7B3D] active:scale-[0.97]
            "
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="mt-6 px-6">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-4 top-3.5 text-[#7F776F]"
            />

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="
                w-full rounded-2xl border border-[#2B2926] bg-[#211E1C]
                py-3 pl-11 pr-4 text-sm text-white
                placeholder:text-[#7F776F]
                outline-none transition-all focus:border-[#FF641F]
              "
            />
          </div>
        </div>

        {/* History */}
        <div className="mt-6 flex-1 overflow-y-auto px-4 pb-4">
          {conversations.length === 0 && (
            <p className="px-3 pt-4 text-sm text-[#7F776F]">
              {searchQuery ? "No chats found." : "No chats yet. Say hi!"}
            </p>
          )}

          {[...groups.entries()].map(([label, chats]) => (
            <div key={label} className="mb-5">
              <p className="mb-2 px-3 text-[11px] uppercase tracking-[0.25em] text-[#7F776F]">
                {label}
              </p>

              <div className="space-y-1">
                {chats.map((chat) => {
                  const active = activeConversationId === chat.id;
                  const editing = editingId === chat.id;

                  return (
                    <div
                      key={chat.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!editing) onConversationSelect(chat.id);
                      }}
                      onDoubleClick={() => startEdit(chat)}
                      onKeyDown={(e) => {
                        if (
                          e.target === e.currentTarget &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          onConversationSelect(chat.id);
                        }
                      }}
                      className={`
                        group flex w-full cursor-pointer items-center
                        justify-between gap-2 rounded-2xl border
                        px-4 py-3 text-left transition-colors
                        ${
                          active
                            ? "border-[#FF641F] bg-[#26221F]"
                            : "border-transparent hover:bg-[#211E1C]"
                        }
                      `}
                    >
                      {editing ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitEdit}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") {
                              cancelledRef.current = true;
                              setEditingId(null);
                            }
                          }}
                          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                        />
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                          {chat.title}
                        </span>
                      )}

                      {!editing && (
                        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          <button
                            aria-label="Rename chat"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(chat);
                            }}
                            className="rounded-md p-1 text-[#7F776F] hover:text-white"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            aria-label="Delete chat"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm("Delete this chat?")) {
                                onDeleteConversation(chat.id);
                              }
                            }}
                            className="rounded-md p-1 text-[#7F776F] hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[#2B2926] p-4">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {userEmail}
              </p>
              <p className="mt-0.5 text-xs text-[#7F776F]">BRO AI · v1.0</p>
            </div>

            <button
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              className="shrink-0 rounded-lg p-2 text-[#A9A39D] transition hover:bg-[#2A2623] hover:text-white"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}