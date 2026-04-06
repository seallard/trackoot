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
      <main>
        <p>Loading…</p>
      </main>
    );

  return (
    <main>
      <h1>Trackoot</h1>
      {userId && <button onClick={handleCreateLobby}>Create Lobby</button>}
    </main>
  );
}
