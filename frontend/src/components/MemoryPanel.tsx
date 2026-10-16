import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Plus, Pencil, Check } from "lucide-react";
import {
  getMemories,
  addMemory,
  updateMemory,
  deleteMemory,
  type Memory,
} from "../services/memory";

interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: { key: Memory["category"]; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "preference", label: "Preferences" },
  { key: "skill", label: "Skills" },
  { key: "project", label: "Projects" },
];

export default function MemoryPanel({ open, onClose }: MemoryPanelProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState<string>("profile");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const data = await getMemories();
      setMemories(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  async function handleDelete(id: number) {
    await deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  function startEdit(m: Memory) {
    setEditingId(m.id);
    setEditValue(m.value);
  }

  async function saveEdit(id: number) {
    const updated = await updateMemory(id, editValue);
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, value: updated.value } : m))
    );
    setEditingId(null);
  }

  async function handleAdd() {
    if (!newKey.trim() || !newValue.trim()) return;

    const created = await addMemory(newCategory, newKey.trim(), newValue.trim());

    setMemories((prev) => {
      const withoutDup = prev.filter(
        (m) => !(m.category === created.category && m.key === created.key)
      );
      return [...withoutDup, { ...created, updated_at: null }];
    });

    setNewKey("");
    setNewValue("");
    setShowAdd(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="
              w-[640px]
              max-h-[80vh]
              overflow-y-auto
              rounded-3xl
              bg-[#181614]
              border
              border-[#2B2926]
              p-8
              shadow-2xl
            "
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-white">Memory</h2>

              <button
                onClick={onClose}
                className="text-[#7F776F] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-[#A9A39D] mb-6">
              What BRO remembers about you. Edit or remove anything that's
              wrong.
            </p>

            {loading && (
              <p className="text-sm text-[#7F776F]">Loading...</p>
            )}

            {!loading && memories.length === 0 && !showAdd && (
              <p className="text-sm text-[#7F776F]">
                Nothing remembered yet. Chat with BRO and it'll start
                picking things up automatically — or add something
                manually below.
              </p>
            )}

            {CATEGORIES.map(({ key, label }) => {
              const items = memories.filter((m) => m.category === key);
              if (items.length === 0) return null;

              return (
                <div key={key} className="mb-6">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-[#7F776F]">
                    {label}
                  </p>

                  <div className="space-y-2">
                    {items.map((m) => (
                      <div
                        key={m.id}
                        className="
                          group
                          flex
                          items-center
                          justify-between
                          gap-3
                          rounded-2xl
                          border
                          border-[#2B2926]
                          bg-[#211E1C]
                          px-4
                          py-3
                        "
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#7F776F] mb-0.5">
                            {m.key.replace(/_/g, " ")}
                          </p>

                          {editingId === m.id ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(m.id);
                              }}
                              className="
                                w-full
                                rounded-lg
                                bg-[#181614]
                                border
                                border-[#FF641F]
                                px-2
                                py-1
                                text-sm
                                text-white
                                outline-none
                              "
                            />
                          ) : (
                            <p className="text-sm text-white truncate">
                              {m.value}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          {editingId === m.id ? (
                            <button
                              onClick={() => saveEdit(m.id)}
                              className="text-[#7F776F] hover:text-green-400"
                            >
                              <Check size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => startEdit(m)}
                              className="text-[#7F776F] hover:text-white"
                            >
                              <Pencil size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(m.id)}
                            className="text-[#7F776F] hover:text-red-400"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {showAdd ? (
              <div className="rounded-2xl border border-[#2B2926] bg-[#211E1C] p-4 space-y-3">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-lg bg-[#181614] border border-[#2B2926] px-3 py-2 text-sm text-white outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <input
                  placeholder="key (e.g. favorite_language)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full rounded-lg bg-[#181614] border border-[#2B2926] px-3 py-2 text-sm text-white placeholder:text-[#7F776F] outline-none"
                />

                <input
                  placeholder="value (e.g. Python)"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full rounded-lg bg-[#181614] border border-[#2B2926] px-3 py-2 text-sm text-white placeholder:text-[#7F776F] outline-none"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    className="flex-1 rounded-lg bg-[#FF641F] hover:bg-[#FF7B3D] py-2 text-sm font-semibold text-white transition-all"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="flex-1 rounded-lg border border-[#2B2926] py-2 text-sm text-[#A9A39D] hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="
                  mt-2
                  flex
                  items-center
                  gap-2
                  text-sm
                  text-[#FF641F]
                  hover:text-[#FF7B3D]
                  transition-colors
                "
              >
                <Plus size={16} />
                Add memory manually
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}