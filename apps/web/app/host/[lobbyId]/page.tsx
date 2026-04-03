"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useLobbyStore } from "@/lib/store";

export default function HostLobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const pin = useLobbyStore((s) => s.pin);
  const players = useLobbyStore((s) => s.players);
  const addPlayer = useLobbyStore((s) => s.addPlayer);

  useEffect(() => {
    const socket = getSocket();

    socket.emit("host:join", { lobbyId });

    socket.on("lobby:player_joined", ({ player }) => {
      addPlayer(player);
    });

    return () => {
      socket.off("lobby:player_joined");
    };
  }, [lobbyId, addPlayer]);

  return (
    <main>
      <h1>Trackoot</h1>
      <p>PIN: <strong>{pin}</strong></p>
      <h2>Players ({players.length})</h2>
      <ul>
        {players.map((p) => (
          <li key={p.playerId}>{p.displayName}</li>
        ))}
      </ul>
    </main>
  );
}
