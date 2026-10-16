import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import ChatPage from "./pages/ChatPage";
import AuthPage from "./pages/AuthPage";

import { fetchMe, clearToken, setUnauthorizedHandler } from "./services/auth";
import type { User } from "./services/auth";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If the server ever says "not logged in", go back to the login page
    setUnauthorizedHandler(() => setUser(null));

    let cancelled = false;

    fetchMe().then((me) => {
      if (cancelled) return;
      setUser(me);
      setChecking(false);
    });

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  function handleLogout() {
    clearToken();
    setUser(null);
  }

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#121110]">
        <Loader2 size={28} className="animate-spin text-[#FF641F]" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthenticated={setUser} />;
  }

  return <ChatPage key={user.id} user={user} onLogout={handleLogout} />;
}

export default App;