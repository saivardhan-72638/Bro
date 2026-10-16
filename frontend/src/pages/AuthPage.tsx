import { useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { login, register } from "../services/auth";
import type { User } from "../services/auth";

interface Props {
  onAuthenticated: (user: User) => void;
}

function AuthPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError(null);
    setBusy(true);

    try {
      const user =
        mode === "login"
          ? await login(email, password)
          : await register(email, password);

      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#121110] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white">
            BRO
          </h1>
          <p className="mt-3 text-[#A9A39D]">Less overthinking. More doing.</p>
        </div>

        <div className="mt-10 rounded-3xl border border-[#2B2926] bg-[#1A1816] p-8 shadow-2xl">
          {/* Mode switch */}
          <div className="grid grid-cols-2 rounded-2xl bg-[#121110] p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                  mode === m
                    ? "bg-[#FF641F] text-white"
                    : "text-[#A9A39D] hover:text-white"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-[#A9A39D]">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-[#2B2926] bg-[#211E1C] px-4 py-3 text-white outline-none transition placeholder:text-[#7F776F] focus:border-[#FF641F]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#A9A39D]">
                Password
              </label>
              <input
                type="password"
                required
                minLength={isLogin ? undefined : 8}
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? "Your password" : "At least 8 characters"}
                className="w-full rounded-2xl border border-[#2B2926] bg-[#211E1C] px-4 py-3 text-white outline-none transition placeholder:text-[#7F776F] focus:border-[#FF641F]"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF641F] py-3.5 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF7B3D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 size={18} className="animate-spin" />}
              {isLogin ? "Log in" : "Create account"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default AuthPage;