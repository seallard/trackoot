"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ANSWER_SYMBOLS } from "@trackoot/types";
import type { AnswerSymbol } from "@trackoot/types";
import { getSocket } from "@/lib/socket";
import { useLobbyStore } from "@/lib/store";
import { SYMBOL_META } from "@/lib/symbols";

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
    socket.emit("player:join", { lobbyId, playerId, displayName });

    socket.on("lobby:reset", () => resetGame());
    socket.on("game:round_start", ({ round, endsAt }) => startRound(round, endsAt));
    socket.on("game:round_end", ({ correctSymbol, scores }) => endRound(correctSymbol, scores));
    socket.on("game:over", ({ finalStandings }) => endGame(finalStandings));

    return () => {
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

  if (gamePhase === "game_over" && finalStandings) {
    const myRank = finalStandings.findIndex((s) => s.playerId === playerId) + 1;
    const myResult = finalStandings.find((s) => s.playerId === playerId);
    const medals = ["🥇", "🥈", "🥉"];
    return (
      <main className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-5xl font-black">Game Over!</h1>
        <div className="rounded-2xl bg-game-surface px-10 py-6">
          <p className="text-4xl font-black">{medals[myRank - 1] ?? `#${myRank}`}</p>
          <p className="mt-1 text-2xl font-bold">{myResult?.totalScore ?? 0} pts</p>
        </div>
        <ol className="w-full max-w-sm space-y-2">
          {finalStandings.map((s, i) => (
            <li
              key={s.playerId}
              className={`flex items-center justify-between rounded-xl px-4 py-3 font-semibold ${s.playerId === playerId ? "bg-white text-game-bg" : "bg-white/10"}`}
            >
              <span>
                {medals[i] ?? `#${i + 1}`} {s.displayName}
              </span>
              <span>{s.totalScore} pts</span>
            </li>
          ))}
        </ol>
      </main>
    );
  }

  if (gamePhase === "round_results" && scores && correctSymbol) {
    const myScore = scores.find((s) => s.playerId === playerId);
    const isCorrect = submittedSymbol === correctSymbol;
    return (
      <main
        className={`flex h-full flex-col items-center justify-center gap-4 text-center ${isCorrect ? "bg-answer-square" : "bg-answer-triangle"}`}
      >
        <p className="text-6xl">{isCorrect ? "✓" : "✗"}</p>
        <p className="text-3xl font-black">{isCorrect ? "Correct!" : "Wrong"}</p>
        <p className="text-5xl font-black">+{myScore?.roundScore ?? 0}</p>
        <p className="text-lg text-white/80">Total: {myScore?.totalScore ?? 0} pts</p>
      </main>
    );
  }

  if (gamePhase === "round_active" && round) {
    const activeSymbols = ANSWER_SYMBOLS.filter((s) => round.options.some((o) => o.symbol === s));
    return (
      <main className="grid h-full grid-cols-2 grid-rows-2">
        {activeSymbols.map((symbol) => {
          const meta = SYMBOL_META[symbol];
          const isSubmitted = submittedSymbol === symbol;
          const isOther = !!submittedSymbol && !isSubmitted;
          return (
            <button
              key={symbol}
              onClick={() => handleAnswer(symbol)}
              disabled={!!submittedSymbol}
              className={`${meta.bg} flex flex-col items-center justify-center gap-3 text-white transition ${isOther ? "opacity-40" : ""} ${isSubmitted ? "ring-4 ring-inset ring-white" : ""} active:brightness-75 disabled:cursor-default`}
            >
              <span className="text-5xl">{meta.label}</span>
            </button>
          );
        })}
      </main>
    );
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-5xl font-black">🎵 Trackoot</h1>
      <div className="rounded-full bg-game-surface px-6 py-2 font-semibold">{displayName}</div>
      <p className="animate-pulse text-white/70">Waiting for host to start…</p>
    </main>
  );
}
