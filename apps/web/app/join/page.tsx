"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "@/lib/session";
import { useLobbyStore } from "@/lib/store";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

function generateGuestId() {
  return `guest_${Math.random().toString(36).slice(2, 10)}`;
}

export default function JoinPage() {
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const router = useRouter();
  const setPlayerIdentity = useLobbyStore((s) => s.setPlayerIdentity);
  const setAuth = useLobbyStore((s) => s.setAuth);

  useEffect(() => {
    // Check for Spotify OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get("userId");
    const urlDisplayName = params.get("displayName");
    const urlRole = params.get("role");

    if (urlUserId && urlDisplayName && urlRole === "player") {
      saveSession({ userId: urlUserId, displayName: urlDisplayName, role: "player" });
      setAuth(urlUserId, urlDisplayName, "player");
      setResolvedUserId(urlUserId);
      setName(urlDisplayName);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // Check for existing session
    const stored = loadSession();
    if (stored?.role === "player") {
      setAuth(stored.userId, stored.displayName, "player");
      setResolvedUserId(stored.userId);
      setName(stored.displayName);
      return;
    }

    // No session — guest mode
    setResolvedUserId(generateGuestId());
  }, [setAuth]);

  async function handleJoin() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a display name.");
      return;
    }
    const res = await fetch(`${SERVER_URL}/lobbies/pin/${pin}`);
    if (!res.ok) {
      setError("Invalid PIN — no lobby found.");
      return;
    }
    const { lobbyId } = await res.json();
    setPlayerIdentity(resolvedUserId!, trimmedName);
    router.push(`/play/${lobbyId}`);
  }

  function handleSpotifyLogin() {
    window.location.href = `${SERVER_URL}/auth/spotify?role=player`;
  }

  const isGuest = resolvedUserId?.startsWith("guest_");

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-5xl font-black tracking-tight">🎵 Trackoot</h1>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <input
          type="text"
          maxLength={30}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border-2 border-white/30 bg-white/10 px-5 py-4 text-lg font-semibold placeholder-white/40 outline-none focus:border-white"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Game PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-xl border-2 border-white/30 bg-white/10 px-5 py-4 text-center text-2xl font-black tracking-widest placeholder-white/40 outline-none focus:border-white"
        />

        {error && <p className="text-center font-semibold text-red-400">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={pin.length !== 6 || !name.trim() || !resolvedUserId}
          className="w-full rounded-xl bg-answer-square py-4 text-xl font-bold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join
        </button>

        {isGuest ? (
          <button
            onClick={handleSpotifyLogin}
            className="text-sm text-white/50 underline transition hover:text-white/80"
          >
            Sign in with Spotify for personalized questions
          </button>
        ) : (
          <button
            onClick={() => {
              sessionStorage.clear();
              setResolvedUserId(generateGuestId());
              setName("");
            }}
            className="text-sm text-white/50 underline transition hover:text-white/80"
          >
            Join as guest instead
          </button>
        )}
      </div>
    </main>
  );
}
