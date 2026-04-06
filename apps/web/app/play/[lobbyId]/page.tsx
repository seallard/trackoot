"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ANSWER_SYMBOLS } from "@trackoot/types";
import type { AnswerSymbol } from "@trackoot/types";
import { getSocket } from "@/lib/socket";
import { useLobbyStore } from "@/lib/store";

const SYMBOL_LABELS: Record<AnswerSymbol, string> = {
  triangle: "▲",
  diamond: "◆",
  circle: "●",
  square: "■",
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
    const myResult = finalStandings.find((s) => s.playerId === playerId);
    const myRank = finalStandings.findIndex((s) => s.playerId === playerId) + 1;
    return (
      <main>
        <h1>Game Over</h1>
        <p>
          You finished #{myRank} with {myResult?.totalScore ?? 0} pts
        </p>
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
    const myScore = scores.find((s) => s.playerId === playerId);
    const isCorrect = submittedSymbol === correctSymbol;
    return (
      <main>
        <h2>{isCorrect ? "Correct!" : "Wrong"}</h2>
        <p>+{myScore?.roundScore ?? 0} pts</p>
        <p>Total: {myScore?.totalScore ?? 0} pts</p>
      </main>
    );
  }

  if (gamePhase === "round_active" && round) {
    return (
      <main>
        <p>{submittedSymbol ? "Answer submitted — waiting for others…" : "Choose your answer:"}</p>
        <div>
          {ANSWER_SYMBOLS.filter((s) => round.options.some((o) => o.symbol === s)).map((symbol) => (
            <button key={symbol} onClick={() => handleAnswer(symbol)} disabled={!!submittedSymbol}>
              {SYMBOL_LABELS[symbol]}
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Trackoot</h1>
      <p>
        Joined as <strong>{displayName}</strong>
      </p>
      <p>Waiting for the host to start the game…</p>
    </main>
  );
}
