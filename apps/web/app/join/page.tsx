"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLobbyStore } from "@/lib/store";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

const ADJECTIVES = ["Quick", "Lazy", "Happy", "Wild", "Brave", "Calm", "Dizzy", "Funky"];
const NOUNS = ["Fox", "Bear", "Tiger", "Eagle", "Wolf", "Shark", "Panda", "Sloth"];

function randomDisplayName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}`;
}

export default function JoinPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const setPlayerIdentity = useLobbyStore((s) => s.setPlayerIdentity);

  async function handleJoin() {
    setError(null);
    const res = await fetch(`${SERVER_URL}/lobbies/pin/${pin}`);
    if (!res.ok) {
      setError("Invalid PIN — no lobby found.");
      return;
    }
    const { lobbyId } = await res.json();
    const playerId = crypto.randomUUID();
    const displayName = randomDisplayName();
    setPlayerIdentity(playerId, displayName);
    router.push(`/play/${lobbyId}`);
  }

  return (
    <main>
      <h1>Join Game</h1>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        placeholder="Enter PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
      />
      <button onClick={handleJoin} disabled={pin.length !== 6}>
        Join
      </button>
      {error && <p>{error}</p>}
    </main>
  );
}
