import { useEffect, useState } from "react";
import { loadSession, saveSession } from "./session";
import { useLobbyStore } from "./store";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export function useAuth(role: "host" | "player"): { loading: boolean } {
  const [loading, setLoading] = useState(true);
  const setAuth = useLobbyStore((s) => s.setAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get("userId");
    const urlDisplayName = params.get("displayName");
    const urlRole = params.get("role");

    if (urlUserId && urlDisplayName && urlRole === role) {
      saveSession({ userId: urlUserId, displayName: urlDisplayName, role });
      setAuth(urlUserId, urlDisplayName, role);
      window.history.replaceState({}, "", window.location.pathname);
      setLoading(false);
      return;
    }

    const stored = loadSession();
    if (stored?.role === role) {
      setAuth(stored.userId, stored.displayName, role);
      setLoading(false);
      return;
    }

    window.location.href = `${SERVER_URL}/auth/spotify?role=${role}`;
  }, [role, setAuth]);

  return { loading };
}
