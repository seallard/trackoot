"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useLobbyStore } from "@/lib/store";
import { SYMBOL_META } from "@/lib/symbols";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function HostLobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userId = useLobbyStore((s) => s.userId);
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
  const resetGame = useLobbyStore((s) => s.resetGame);

  // Load Spotify Web Playback SDK and initialize player
  useEffect(() => {
    if (!userId) return;

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Trackoot Host",
        getOAuthToken: (cb) => {
          fetch(`${SERVER_URL}/auth/token/${userId}`)
            .then((r) => r.json())
            .then(({ accessToken }: { accessToken: string }) => cb(accessToken))
            .catch(console.error);
        },
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }) => {
        getSocket().emit("host:player_ready", { lobbyId, deviceId: device_id });
      });

      player.connect();
    };

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [lobbyId, userId]);

  // Set up socket listeners
  useEffect(() => {
    const socket = getSocket();
    socket.emit("host:join", { lobbyId });

    socket.on("lobby:player_joined", ({ player }) => addPlayer(player));
    socket.on("lobby:reset", () => resetGame());
    socket.on("game:round_start", ({ round, endsAt }) => startRound(round, endsAt));
    socket.on("game:round_end", ({ correctSymbol, scores }) => endRound(correctSymbol, scores));
    socket.on("game:over", ({ finalStandings }) => endGame(finalStandings));

    return () => {
      socket.off("lobby:player_joined");
      socket.off("lobby:reset");
      socket.off("game:round_start");
      socket.off("game:round_end");
      socket.off("game:over");
    };
  }, [lobbyId, addPlayer, startRound, endRound, endGame, resetGame]);

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
    getSocket().emit("host:start_game", { lobbyId });
  }

  function handlePlayAgain() {
    getSocket().emit("host:reset_game", { lobbyId });
  }

  // --- Game Over ---
  if (gamePhase === "game_over" && finalStandings) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-8 px-8 text-center">
        <h1 className="text-6xl font-black">Game Over!</h1>
        <ol className="w-full max-w-lg space-y-3">
          {finalStandings.map((s, i) => (
            <li
              key={s.playerId}
              className="flex items-center justify-between rounded-2xl bg-game-surface px-6 py-4 text-xl font-bold"
            >
              <span>
                {MEDALS[i] ?? `#${i + 1}`} {s.displayName}
              </span>
              <span className="text-white/80">{s.totalScore} pts</span>
            </li>
          ))}
        </ol>
        <button
          onClick={handlePlayAgain}
          className="rounded-full bg-white px-10 py-4 text-xl font-bold text-game-bg transition hover:bg-white/90 active:scale-95"
        >
          Play Again
        </button>
      </main>
    );
  }

  // --- Round Results ---
  if (gamePhase === "round_results" && scores && correctSymbol) {
    const meta = SYMBOL_META[correctSymbol];
    return (
      <main className="flex h-full flex-col items-center justify-center gap-8 px-8">
        <div className={`${meta.bg} flex items-center gap-4 rounded-2xl px-8 py-5`}>
          <span className="text-4xl">{meta.label}</span>
          <span className="text-2xl font-black">Correct answer!</span>
        </div>
        <ol className="w-full max-w-lg space-y-3">
          {scores.map((s, i) => (
            <li
              key={s.playerId}
              className="flex items-center justify-between rounded-2xl bg-game-surface px-6 py-4 text-lg font-semibold"
            >
              <span>
                {MEDALS[i] ?? `#${i + 1}`} {s.displayName}
              </span>
              <span>
                <span className="text-answer-square font-bold">+{s.roundScore}</span>
                <span className="ml-3 text-white/60">{s.totalScore} total</span>
              </span>
            </li>
          ))}
        </ol>
      </main>
    );
  }

  // --- Round Active ---
  if (gamePhase === "round_active" && round) {
    const question = round.question;
    const questionText =
      question.type === "WHO_LISTENS_MOST_ARTIST"
        ? `Who listens the most to ${question.artistName}?`
        : "Who listens the most?";

    const timerColor =
      (secondsLeft ?? 20) > 10
        ? "text-white"
        : (secondsLeft ?? 20) > 5
          ? "text-yellow-400"
          : "text-red-400";

    return (
      <main className="flex h-full flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-game-surface px-8 py-4">
          <span className="font-semibold text-white/70">Round {round.roundNumber}</span>
          <span className={`text-5xl font-black tabular-nums ${timerColor}`}>
            {secondsLeft ?? 20}
          </span>
        </div>

        {/* Question */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          {question.type === "WHO_LISTENS_MOST_ARTIST" && question.artistImageUrl && (
            <img
              src={question.artistImageUrl}
              alt={question.artistName}
              className="h-32 w-32 rounded-full object-cover shadow-2xl"
            />
          )}
          <h2 className="text-4xl font-black leading-tight">{questionText}</h2>
        </div>

        {/* Answer grid */}
        <div className="grid grid-cols-2 gap-3 p-6">
          {round.options.map((opt) => {
            const meta = SYMBOL_META[opt.symbol];
            return (
              <div
                key={opt.symbol}
                className={`${meta.bg} flex items-center gap-3 rounded-2xl px-5 py-4 font-bold text-white`}
              >
                <span className="text-2xl">{meta.label}</span>
                <span className="text-lg">{opt.label}</span>
              </div>
            );
          })}
        </div>
      </main>
    );
  }

  // --- Lobby Waiting ---
  return (
    <main className="flex h-full flex-col items-center justify-center gap-10 px-8 text-center">
      <div>
        <p className="text-lg font-semibold uppercase tracking-widest text-white/60">Game PIN</p>
        <p className="text-8xl font-black tracking-widest">{pin}</p>
      </div>

      <div className="w-full max-w-2xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">
          Players ({players.length})
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {players.map((p) => (
            <div
              key={p.playerId}
              className="flex items-center gap-2 rounded-full bg-game-surface px-4 py-2 font-semibold"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-black">
                {p.displayName[0].toUpperCase()}
              </span>
              {p.displayName}
            </div>
          ))}
          {players.length === 0 && (
            <p className="animate-pulse text-white/40">Waiting for players to join…</p>
          )}
        </div>
      </div>

      <button
        onClick={handleStartGame}
        disabled={players.length < 1}
        className="rounded-full bg-answer-square px-12 py-5 text-2xl font-black transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start Game
      </button>
    </main>
  );
}
