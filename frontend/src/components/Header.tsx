import { motion } from "framer-motion";
import { BrainCircuit, Menu } from "lucide-react";

interface HeaderProps {
  title: string;
  online: boolean;
  models: string[];
  model: string;
  onModelChange: (model: string) => void;
  onOpenMemory: () => void;
  onOpenSidebar: () => void;
}

function Header({
  title,
  online,
  models,
  model,
  onModelChange,
  onOpenMemory,
  onOpenSidebar,
}: HeaderProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="
        flex h-20 shrink-0 items-center justify-between gap-3
        border-b border-[#2B2926] bg-[#121110]
        px-4 md:px-10
      "
    >
      {/* Left */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className="rounded-lg p-2 text-[#A9A39D] hover:text-white md:hidden"
        >
          <Menu size={22} />
        </button>

        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight text-white md:text-2xl">
            {title}
          </h2>

          <p className="mt-1 hidden text-sm text-[#A9A39D] sm:block">
            Your AI workspace
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {models.length > 0 && (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            aria-label="Choose model"
            className="
              max-w-[140px] rounded-full border border-[#2B2926]
              bg-[#1E1C1A] px-3 py-2 text-sm font-medium text-white
              outline-none transition hover:border-[#FF641F]
              focus:border-[#FF641F]
            "
          >
            {models.map((m) => (
              <option key={m} value={m} className="bg-[#1E1C1A]">
                {m}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onOpenMemory}
          className="
            flex items-center gap-2 rounded-full border border-[#2B2926]
            bg-[#1E1C1A] px-4 py-2 text-sm font-medium text-white
            transition-all hover:border-[#FF641F]
          "
        >
          <BrainCircuit size={16} className="text-[#FF641F]" />
          <span className="hidden sm:inline">Memory</span>
        </button>

        <div className="hidden items-center gap-3 rounded-full border border-[#2B2926] bg-[#1E1C1A] px-4 py-2 sm:flex">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              online ? "animate-pulse bg-green-400" : "bg-red-500"
            }`}
          />

          <span className="text-sm font-medium text-white">
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    </motion.header>
  );
}

export default Header;