"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useLobbyStore } from "@/lib/store";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export default function HostPage() {
  const router = useRouter();
  const { loading } = useAuth("host");
  const setPin = useLobbyStore((s) => s.setPin);
  const userId = useLobbyStore((s) => s.userId);

  async function handleCreateLobby() {
    const res = await fetch(`${SERVER_URL}/lobbies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId: userId }),
    });
    const { lobbyId, pin } = await res.json();
    setPin(pin);
    router.push(`/host/${lobbyId}`);
  }

  if (loading)
    return (
      <main className="flex h-full items-center justify-center">
        <p className="animate-pulse text-xl text-white/70">Loading…</p>
      </main>
    );

  return (
    <main className="flex h-full flex-col items-center justify-center gap-8">
      <h1 className="text-6xl font-black tracking-tight">🎵 Trackoot</h1>
      <p className="text-white/70">Sign in successful. Ready to host?</p>
      {userId && (
        <button
          onClick={handleCreateLobby}
          className="rounded-full bg-white px-10 py-4 text-xl font-bold text-game-bg transition hover:bg-white/90 active:scale-95"
        >
          Create Lobby
        </button>
      )}
    </main>
  );
}
