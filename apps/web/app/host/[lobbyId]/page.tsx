"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useLobbyStore } from "@/lib/store";

const SYMBOL_LABELS: Record<string, string> = {
  triangle: "▲ Triangle",
  diamond: "◆ Diamond",
  circle: "● Circle",
  square: "■ Square",
};

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export default function HostLobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pin = useLobbyStore((s) => s.pin);
  const players = useLobbyStore((s) => s.players);
  const gamePhase = useLobbyStore((s) => s.gamePhase);
  const round = useLobbyStore((s) => s.round);
  const endsAt = useLobbyStore((s) => s.endsAt);
  const correctSymbol = useLobbyStore((s) => s.correctSymbol);
  const scores = useLobbyStore((s) => s.scores);
  const finalStandings = useLobbyStore((s) => s.finalStandings);

  const addPlayer = useLobbyStore((s) => s.addPlayer);
  const startRound = useLobbyStore((s) => s.startRound);
  const endRound = useLobbyStore((s) => s.endRound);
  const endGame = useLobbyStore((s) => s.endGame);

  // Set up socket listeners
  useEffect(() => {
    const socket = getSocket();
    socket.emit("host:join", { lobbyId });

    socket.on("lobby:player_joined", ({ player }) => addPlayer(player));
    socket.on("game:round_start", ({ round, endsAt }) => startRound(round, endsAt));
    socket.on("game:round_end", ({ correctSymbol, scores }) => endRound(correctSymbol, scores));
    socket.on("game:over", ({ finalStandings }) => endGame(finalStandings));

    return () => {
      socket.off("lobby:player_joined");
      socket.off("game:round_start");
      socket.off("game:round_end");
      socket.off("game:over");
    };
  }, [lobbyId, addPlayer, startRound, endRound, endGame]);

  // Countdown timer
  useEffect(() => {
    if (gamePhase !== "round_active" || !endsAt) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && intervalRef.current) clearInterval(intervalRef.current);
    }, 200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gamePhase, endsAt]);

  function handleStartGame() {
    const socket = getSocket();
    socket.emit("host:start_game", { lobbyId });
  }

  if (gamePhase === "game_over" && finalStandings) {
    return (
      <main>
        <h1>Game Over</h1>
        <ol>
          {finalStandings.map((s) => (
            <li key={s.playerId}>
              {s.displayName} — {s.totalScore} pts
            </li>
          ))}
        </ol>
      </main>
    );
  }

  if (gamePhase === "round_results" && scores && correctSymbol) {
    return (
      <main>
        <h2>Correct answer: {SYMBOL_LABELS[correctSymbol]}</h2>
        <ol>
          {scores.map((s) => (
            <li key={s.playerId}>
              {s.displayName} — +{s.roundScore} pts ({s.totalScore} total)
            </li>
          ))}
        </ol>
      </main>
    );
  }

  if (gamePhase === "round_active" && round) {
    const question = round.question;
    const questionText =
      question.type === "WHO_LISTENS_MOST_ARTIST"
        ? `Who listens the most to ${question.artistName}?`
        : "Who listens the most?";

    return (
      <main>
        <p>{secondsLeft}s</p>
        <h2>{questionText}</h2>
        <ul>
          {round.options.map((opt) => (
            <li key={opt.symbol}>
              {SYMBOL_LABELS[opt.symbol]}: {opt.label}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  // Lobby waiting screen
  return (
    <main>
      <h1>Trackoot</h1>
      <p>
        PIN: <strong>{pin}</strong>
      </p>
      <h2>Players ({players.length})</h2>
      <ul>
        {players.map((p) => (
          <li key={p.playerId}>{p.displayName}</li>
        ))}
      </ul>
      <button onClick={handleStartGame} disabled={players.length < 2}>
        Start Game
      </button>
    </main>
  );
}
