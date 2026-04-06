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

  // Pre-fill name once displayName is available from auth
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
      <main>
        <p>Loading…</p>
      </main>
    );

  return (
    <main>
      <h1>Join Game</h1>
      <input
        type="text"
        maxLength={30}
        placeholder="Display name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        placeholder="Enter PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
      />
      <button onClick={handleJoin} disabled={pin.length !== 6 || !name.trim()}>
        Join
      </button>
      {error && <p>{error}</p>}
    </main>
  );
}
