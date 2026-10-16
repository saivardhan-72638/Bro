import { motion } from "framer-motion";

function TypingIndicator() {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.25,
      }}
      className="flex justify-start"
    >
      <div
        className="
          max-w-sm
          rounded-3xl
          border
          border-[#2B2926]
          bg-[#1E1C1A]
          px-6
          py-5
          shadow-xl
        "
      >
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#A9A39D]">
          BRO
        </div>

        <div className="flex items-center gap-2">

          <motion.div
            className="h-2.5 w-2.5 rounded-full bg-[#FF641F]"
            animate={{
              y: [0, -6, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="h-2.5 w-2.5 rounded-full bg-[#FF641F]"
            animate={{
              y: [0, -6, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
              delay: 0.15,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="h-2.5 w-2.5 rounded-full bg-[#FF641F]"
            animate={{
              y: [0, -6, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
              delay: 0.3,
              ease: "easeInOut",
            }}
          />

        </div>
      </div>
    </motion.div>
  );
}

export default TypingIndicator;