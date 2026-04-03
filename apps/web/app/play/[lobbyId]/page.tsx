"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useLobbyStore } from "@/lib/store";

export default function PlayPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const playerId = useLobbyStore((s) => s.playerId);
  const displayName = useLobbyStore((s) => s.displayName);

  useEffect(() => {
    if (!playerId || !displayName) return;
    const socket = getSocket();
    socket.emit("player:join", { lobbyId, playerId, displayName });
  }, [lobbyId, playerId, displayName]);

  return (
    <main>
      <h1>Trackoot</h1>
      <p>Joined as <strong>{displayName}</strong></p>
      <p>Waiting for the host to start the game…</p>
    </main>
  );
}
