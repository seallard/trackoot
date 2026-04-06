"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useLobbyStore } from "@/lib/store";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export default function JoinPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { loading } = useAuth("player");
  const router = useRouter();
  const setPlayerIdentity = useLobbyStore((s) => s.setPlayerIdentity);
  const userId = useLobbyStore((s) => s.userId);
  const displayName = useLobbyStore((s) => s.displayName);
  const [name, setName] = useState("");

  useEffect(() => {
    if (displayName && !name) setName(displayName);
  }, [displayName]);

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
    setPlayerIdentity(userId!, trimmedName);
    router.push(`/play/${lobbyId}`);
  }

  if (loading)
    return (
      <main className="flex h-full items-center justify-center">
        <p className="animate-pulse text-xl text-white/70">Loading…</p>
      </main>
    );

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
          disabled={pin.length !== 6 || !name.trim()}
          className="w-full rounded-xl bg-answer-square py-4 text-xl font-bold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join
        </button>
      </div>
    </main>
  );
}
