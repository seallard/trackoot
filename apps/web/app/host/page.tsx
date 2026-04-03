"use client";

import { useRouter } from "next/navigation";
import { useLobbyStore } from "@/lib/store";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export default function HostPage() {
  const router = useRouter();
  const setPin = useLobbyStore((s) => s.setPin);

  async function handleCreateLobby() {
    const res = await fetch(`${SERVER_URL}/lobbies`, { method: "POST" });
    const { lobbyId, pin } = await res.json();
    setPin(pin);
    router.push(`/host/${lobbyId}`);
  }

  return (
    <main>
      <h1>Trackoot</h1>
      <button onClick={handleCreateLobby}>Create Lobby</button>
    </main>
  );
}
