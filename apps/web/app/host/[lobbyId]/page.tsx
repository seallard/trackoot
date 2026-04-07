"use client";

import { cn } from "@/lib/cn";
import { getSocket } from "@/lib/socket";
import { useLobbyStore } from "@/lib/store";
import { SYMBOL_META } from "@/lib/symbols";
import { useCountUp } from "@/lib/useCountUp";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

const MEDALS = ["🥇", "🥈", "🥉"];

const ROUND_DURATION_S = 20;

const phaseVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2 } },
};

interface PlayerScore {
  playerId: string;
  displayName: string;
  roundScore: number;
  totalScore: number;
}

function ScoreRow({ s, i }: { s: PlayerScore; i: number }) {
  const roundAnim = useCountUp(s.roundScore);
  const totalAnim = useCountUp(s.totalScore, s.totalScore - s.roundScore);
  return (
    <motion.li
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.1, duration: 0.3 }}
      className="flex items-center justify-between rounded-2xl bg-game-surface px-6 py-4 text-lg font-semibold"
    >
      <span>
        {MEDALS[i] ?? `#${i + 1}`} {s.displayName}
      </span>
      <span>
        <span className="font-bold text-answer-square">+{roundAnim}</span>
        <span className="ml-3 text-white/60">{totalAnim} total</span>
      </span>
    </motion.li>
  );
}

function StandingRow({ s, i }: { s: PlayerScore; i: number }) {
  const totalAnim = useCountUp(s.totalScore);
  return (
    <motion.li
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.1, duration: 0.3 }}
      className="flex items-center justify-between rounded-2xl bg-game-surface px-6 py-4 text-xl font-bold"
    >
      <span>
        {MEDALS[i] ?? `#${i + 1}`} {s.displayName}
      </span>
      <span className="text-white/80">{totalAnim} pts</span>
    </motion.li>
  );
}

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
  const answeredCount = useLobbyStore((s) => s.answeredCount);
  const totalPlayers = useLobbyStore((s) => s.totalPlayers);
  const currentTrackId = useLobbyStore((s) => s.currentTrackId);

  const addPlayer = useLobbyStore((s) => s.addPlayer);
  const startRound = useLobbyStore((s) => s.startRound);
  const endRound = useLobbyStore((s) => s.endRound);
  const endGame = useLobbyStore((s) => s.endGame);
  const resetGame = useLobbyStore((s) => s.resetGame);
  const setAnsweredCount = useLobbyStore((s) => s.setAnsweredCount);
  const setTrackChanged = useLobbyStore((s) => s.setTrackChanged);

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

    function joinRoom() {
      socket.emit("host:join", { lobbyId });
    }

    joinRoom();
    socket.on("connect", joinRoom);

    socket.on("lobby:player_joined", ({ player }) => addPlayer(player));
    socket.on("lobby:reset", () => resetGame());
    socket.on("game:round_start", ({ round, endsAt }) => startRound(round, endsAt));
    socket.on("game:round_end", ({ correctSymbol, scores }) => endRound(correctSymbol, scores));
    socket.on("game:over", ({ finalStandings }) => endGame(finalStandings));
    socket.on("game:round_answer_status", ({ answeredCount, totalPlayers }) =>
      setAnsweredCount(answeredCount, totalPlayers),
    );
    socket.on("game:track_changed", ({ trackId }) => setTrackChanged(trackId));

    return () => {
      socket.off("connect", joinRoom);
      socket.off("lobby:player_joined");
      socket.off("lobby:reset");
      socket.off("game:round_start");
      socket.off("game:round_end");
      socket.off("game:over");
      socket.off("game:round_answer_status");
      socket.off("game:track_changed");
    };
  }, [
    lobbyId,
    addPlayer,
    startRound,
    endRound,
    endGame,
    resetGame,
    setAnsweredCount,
    setTrackChanged,
  ]);

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

  const timerPct = ((secondsLeft ?? ROUND_DURATION_S) / ROUND_DURATION_S) * 100;
  const timerBarColor =
    (secondsLeft ?? ROUND_DURATION_S) > 10
      ? "bg-answer-square"
      : (secondsLeft ?? ROUND_DURATION_S) > 5
        ? "bg-answer-circle"
        : "bg-answer-triangle";

  const timerTextColor =
    (secondsLeft ?? ROUND_DURATION_S) > 10
      ? "text-white"
      : (secondsLeft ?? ROUND_DURATION_S) > 5
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <AnimatePresence mode="wait">
      {/* --- Game Over --- */}
      {gamePhase === "game_over" && finalStandings && (
        <motion.main
          key="game_over"
          variants={phaseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex h-full flex-col items-center justify-center gap-8 px-8 text-center"
        >
          <h1 className="text-6xl font-black">Game Over!</h1>
          <ol className="w-full max-w-lg space-y-3">
            {finalStandings.map((s, i) => (
              <StandingRow key={s.playerId} s={s} i={i} />
            ))}
          </ol>
          <button
            type="button"
            onClick={handlePlayAgain}
            className="rounded-full bg-white px-10 py-4 text-xl font-bold text-game-bg transition hover:bg-white/90 active:scale-95"
          >
            Play Again
          </button>
        </motion.main>
      )}

      {/* --- Round Results --- */}
      {gamePhase === "round_results" && scores && correctSymbol && (
        <motion.main
          key="round_results"
          variants={phaseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex h-full flex-col items-center justify-center gap-8 px-8"
        >
          {(() => {
            const meta = SYMBOL_META[correctSymbol];
            return (
              <div className={cn(meta.bg, "flex items-center gap-4 rounded-2xl px-8 py-5")}>
                <span className="text-4xl">{meta.label}</span>
                <span className="text-2xl font-black">Correct answer!</span>
              </div>
            );
          })()}
          <ol className="w-full max-w-lg space-y-3">
            {scores.map((s, i) => (
              <ScoreRow key={s.playerId} s={s} i={i} />
            ))}
          </ol>
        </motion.main>
      )}

      {/* --- Round Active --- */}
      {gamePhase === "round_active" && round && (
        <motion.main
          key={`round_active_${round.roundNumber}`}
          variants={phaseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex h-full flex-col"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between bg-game-surface px-8 py-4">
            <span className="font-semibold text-white/70">Round {round.roundNumber}</span>
            <span className="text-lg font-semibold text-white/60">
              {answeredCount} / {totalPlayers}
            </span>
            <span className={cn("text-5xl font-black tabular-nums", timerTextColor)}>
              {secondsLeft ?? ROUND_DURATION_S}
            </span>
          </div>

          {/* Timer progress bar */}
          <div className="h-2 w-full bg-white/10">
            <div
              className={cn("h-full transition-all duration-200", timerBarColor)}
              style={{ width: `${timerPct}%` }}
            />
          </div>

          {/* Question */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
            {round.question.type === "WHO_LISTENS_MOST_ARTIST" && (
              <>
                {round.question.artistImageUrl && (
                  <img
                    src={round.question.artistImageUrl}
                    alt={round.question.artistName}
                    className="h-32 w-32 rounded-full object-cover shadow-2xl"
                  />
                )}
                <h2 className="text-4xl font-black leading-tight">
                  Who listens the most to {round.question.artistName}?
                </h2>
              </>
            )}
            {round.question.type === "WHOSE_TASTE" &&
              (() => {
                const trackIds = round.question.trackIds;
                const trackNumber = currentTrackId ? trackIds.indexOf(currentTrackId) + 1 : 0;
                return (
                  <>
                    <h2 className="text-4xl font-black leading-tight">
                      Whose music taste is this?
                    </h2>
                    {trackNumber > 0 && (
                      <p className="text-2xl font-semibold text-white/60">
                        🎵 {trackNumber} / {trackIds.length}
                      </p>
                    )}
                  </>
                );
              })()}
          </div>

          {/* Answer grid */}
          <div className="grid grid-cols-2 gap-3 p-6">
            {round.options.map((opt) => {
              const meta = SYMBOL_META[opt.symbol];
              return (
                <div
                  key={opt.symbol}
                  className={cn(
                    meta.bg,
                    "flex items-center gap-3 rounded-2xl px-5 py-4 font-bold text-white",
                  )}
                >
                  <span className="text-2xl">{meta.label}</span>
                  <span className="text-lg">{opt.label}</span>
                </div>
              );
            })}
          </div>
        </motion.main>
      )}

      {/* --- Lobby Waiting --- */}
      {(gamePhase === "waiting" ||
        !["game_over", "round_results", "round_active"].includes(gamePhase)) && (
        <motion.main
          key="waiting"
          variants={phaseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex h-full flex-col items-center justify-center gap-10 px-8 text-center"
        >
          <div>
            <p className="text-lg font-semibold uppercase tracking-widest text-white/60">
              Game PIN
            </p>
            <p className="text-8xl font-black tracking-widest">{pin}</p>
          </div>

          <div className="w-full max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">
              Players ({players.length})
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {players.map((p) => (
                <motion.div
                  key={p.playerId}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="flex items-center gap-2 rounded-full bg-game-surface px-4 py-2 font-semibold"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-sm font-black",
                      p.isGuest ? "bg-white/20" : "bg-answer-square",
                    )}
                  >
                    {p.displayName[0].toUpperCase()}
                  </span>
                  {p.displayName}
                  {p.isGuest && <span className="text-xs font-normal text-white/40">guest</span>}
                </motion.div>
              ))}
              {players.length === 0 && (
                <p className="animate-pulse text-white/40">Waiting for players to join…</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartGame}
            disabled={players.length < 1}
            className="rounded-full bg-answer-square px-12 py-5 text-2xl font-black transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start Game
          </button>
        </motion.main>
      )}
    </AnimatePresence>
  );
}
