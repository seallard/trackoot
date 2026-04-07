"use client";

import { cn } from "@/lib/cn";
import { getSocket } from "@/lib/socket";
import { useLobbyStore } from "@/lib/store";
import { SYMBOL_META } from "@/lib/symbols";
import { useCountUp } from "@/lib/useCountUp";
import { ANSWER_SYMBOLS } from "@trackoot/types";
import type { AnswerSymbol } from "@trackoot/types";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect } from "react";

const MEDALS = ["🥇", "🥈", "🥉"];

const phaseVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2 } },
};

export default function PlayPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();

  const playerId = useLobbyStore((s) => s.playerId);
  const displayName = useLobbyStore((s) => s.displayName);
  const gamePhase = useLobbyStore((s) => s.gamePhase);
  const round = useLobbyStore((s) => s.round);
  const correctSymbol = useLobbyStore((s) => s.correctSymbol);
  const scores = useLobbyStore((s) => s.scores);
  const finalStandings = useLobbyStore((s) => s.finalStandings);
  const submittedSymbol = useLobbyStore((s) => s.submittedSymbol);

  const startRound = useLobbyStore((s) => s.startRound);
  const endRound = useLobbyStore((s) => s.endRound);
  const endGame = useLobbyStore((s) => s.endGame);
  const resetGame = useLobbyStore((s) => s.resetGame);
  const setSubmittedSymbol = useLobbyStore((s) => s.setSubmittedSymbol);

  useEffect(() => {
    if (!playerId || !displayName) return;
    const socket = getSocket();

    const pid = playerId;
    const name = displayName;
    function joinRoom() {
      socket.emit("player:join", { lobbyId, playerId: pid, displayName: name });
    }

    joinRoom();
    socket.on("connect", joinRoom);

    socket.on("lobby:reset", () => resetGame());
    socket.on("game:round_start", ({ round, endsAt }) => startRound(round, endsAt));
    socket.on("game:round_end", ({ correctSymbol, scores }) => endRound(correctSymbol, scores));
    socket.on("game:over", ({ finalStandings }) => endGame(finalStandings));

    return () => {
      socket.off("connect", joinRoom);
      socket.off("lobby:reset");
      socket.off("game:round_start");
      socket.off("game:round_end");
      socket.off("game:over");
    };
  }, [lobbyId, playerId, displayName, startRound, endRound, endGame, resetGame]);

  function handleAnswer(symbol: AnswerSymbol) {
    if (submittedSymbol) return;
    setSubmittedSymbol(symbol);
    getSocket().emit("player:submit_answer", { symbol });
  }

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
          className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center"
        >
          <h1 className="text-5xl font-black">Game Over!</h1>
          <GameOverMyResult finalStandings={finalStandings} playerId={playerId} />
          <ol className="w-full max-w-sm space-y-2">
            {finalStandings.map((s, i) => (
              <motion.li
                key={s.playerId}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 font-semibold",
                  s.playerId === playerId ? "bg-white text-game-bg" : "bg-white/10",
                )}
              >
                <span>
                  {MEDALS[i] ?? `#${i + 1}`} {s.displayName}
                </span>
                <span>{s.totalScore} pts</span>
              </motion.li>
            ))}
          </ol>
        </motion.main>
      )}

      {/* --- Round Results --- */}
      {gamePhase === "round_results" && scores && correctSymbol && (
        <RoundResultsScreen
          scores={scores}
          correctSymbol={correctSymbol}
          submittedSymbol={submittedSymbol}
          playerId={playerId}
        />
      )}

      {/* --- Round Active --- */}
      {gamePhase === "round_active" && round && (
        <motion.main
          key={`round_active_${round.roundNumber}`}
          variants={phaseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="grid h-full grid-cols-2 grid-rows-2"
        >
          {ANSWER_SYMBOLS.filter((s) => round.options.some((o) => o.symbol === s)).map(
            (symbol, i) => {
              const meta = SYMBOL_META[symbol];
              const isSubmitted = submittedSymbol === symbol;
              const isOther = !!submittedSymbol && !isSubmitted;
              return (
                <motion.button
                  key={symbol}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: i * 0.07 }}
                  onClick={() => handleAnswer(symbol)}
                  disabled={!!submittedSymbol}
                  className={cn(
                    meta.bg,
                    "flex flex-col items-center justify-center gap-3 text-white transition",
                    "active:brightness-75 disabled:cursor-default",
                    isOther && "opacity-40",
                    isSubmitted && "ring-4 ring-inset ring-white",
                  )}
                >
                  <span className="text-5xl">{meta.label}</span>
                </motion.button>
              );
            },
          )}
        </motion.main>
      )}

      {/* --- Waiting --- */}
      {gamePhase === "waiting" && (
        <motion.main
          key="waiting"
          variants={phaseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex h-full flex-col items-center justify-center gap-6 text-center"
        >
          <h1 className="text-5xl font-black">🎵 Trackoot</h1>
          <div className="rounded-full bg-game-surface px-6 py-2 font-semibold">{displayName}</div>
          <p className="animate-pulse text-white/70">Waiting for host to start…</p>
        </motion.main>
      )}
    </AnimatePresence>
  );
}

interface PlayerScore {
  playerId: string;
  displayName: string;
  roundScore: number;
  totalScore: number;
}

function GameOverMyResult({
  finalStandings,
  playerId,
}: {
  finalStandings: PlayerScore[];
  playerId: string | null;
}) {
  const myRank = finalStandings.findIndex((s) => s.playerId === playerId) + 1;
  const myResult = finalStandings.find((s) => s.playerId === playerId);
  const totalAnim = useCountUp(myResult?.totalScore ?? 0);
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="rounded-2xl bg-game-surface px-10 py-6"
    >
      <p className="text-4xl font-black">{MEDALS[myRank - 1] ?? `#${myRank}`}</p>
      <p className="mt-1 text-2xl font-bold">{totalAnim} pts</p>
    </motion.div>
  );
}

function RoundResultsScreen({
  scores,
  correctSymbol,
  submittedSymbol,
  playerId,
}: {
  scores: PlayerScore[];
  correctSymbol: AnswerSymbol;
  submittedSymbol: AnswerSymbol | null;
  playerId: string | null;
}) {
  const myScore = scores.find((s) => s.playerId === playerId);
  const isCorrect = submittedSymbol === correctSymbol;
  const roundScore = myScore?.roundScore ?? 0;
  const totalScore = myScore?.totalScore ?? 0;
  const roundAnim = useCountUp(roundScore);
  const totalAnim = useCountUp(totalScore, totalScore - roundScore);

  return (
    <motion.main
      key="round_results"
      variants={phaseVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn("h-full", isCorrect ? "bg-answer-square" : "bg-answer-triangle")}
    >
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-4 text-center",
          !isCorrect && "animate-shake",
        )}
      >
        <p className="text-6xl">{isCorrect ? "✓" : "✗"}</p>
        <p className="text-3xl font-black">{isCorrect ? "Correct!" : "Wrong"}</p>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        >
          <p className="text-5xl font-black">+{roundAnim}</p>
          <p className="text-lg text-white/80">Total: {totalAnim} pts</p>
        </motion.div>
      </div>
    </motion.main>
  );
}
