import type { Server } from "socket.io";
import { ANSWER_SYMBOLS } from "@trackoot/types";
import type {
  AnswerSymbol,
  ClientToServerEvents,
  Player,
  PlayerScore,
  Round,
  ServerToClientEvents,
} from "@trackoot/types";
import { getPlayers, recordScore } from "./lobby";

const ROUND_DURATION_MS = 20_000;
const RESULTS_DISPLAY_MS = 5_000;

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  { playerId?: string; lobbyId?: string }
>;

interface ActiveRound {
  round: Round;
  endsAt: number;
  correctSymbol: AnswerSymbol;
  answers: Map<string, { symbol: AnswerSymbol; receivedAt: number }>;
  timer: ReturnType<typeof setTimeout>;
  ended: boolean;
  playerCount: number;
}

const activeRounds = new Map<string, ActiveRound>();

function buildRound(players: Player[]): { round: Round; correctSymbol: AnswerSymbol } {
  // Hardcoded question — will be replaced by Spotify-generated questions in a later step
  const correctSymbol: AnswerSymbol = "triangle"; // first player is the correct answer
  const options = ANSWER_SYMBOLS.slice(0, players.length).map((symbol, i) => ({
    symbol,
    label: players[i].displayName,
    playerId: players[i].playerId,
  }));

  const round: Round = {
    roundNumber: 1,
    question: {
      type: "WHO_LISTENS_MOST_ARTIST",
      artistId: "4Z8W4fKeB5YxbusRsdQVPb",
      artistName: "Radiohead",
      trackId: "1TfqLAPs4K3s2rJMoCokcS",
    },
    options,
  };

  return { round, correctSymbol };
}

function computeScore(receivedAt: number, roundStartAt: number): number {
  const serverReceivedMs = receivedAt - roundStartAt;
  return Math.round(1000 * (1 - (serverReceivedMs / ROUND_DURATION_MS) * 0.5));
}

export async function startRound(io: IoServer, lobbyId: string, players: Player[]): Promise<void> {
  const { round, correctSymbol } = buildRound(players);
  const endsAt = Date.now() + ROUND_DURATION_MS;

  const timer = setTimeout(() => endRound(io, lobbyId), ROUND_DURATION_MS);

  activeRounds.set(lobbyId, {
    round,
    endsAt,
    correctSymbol,
    answers: new Map(),
    timer,
    ended: false,
    playerCount: players.length,
  });

  io.to(`lobby:${lobbyId}`).emit("game:round_start", { round, endsAt });
}

export async function recordAnswer(
  io: IoServer,
  lobbyId: string,
  playerId: string,
  symbol: AnswerSymbol,
): Promise<void> {
  const active = activeRounds.get(lobbyId);
  if (!active || active.ended) return;
  if (active.answers.has(playerId)) return; // already answered

  active.answers.set(playerId, { symbol, receivedAt: Date.now() });

  if (active.answers.size >= active.playerCount) {
    clearTimeout(active.timer);
    await endRound(io, lobbyId);
  }
}

async function endRound(io: IoServer, lobbyId: string): Promise<void> {
  const active = activeRounds.get(lobbyId);
  if (!active || active.ended) return;
  active.ended = true;

  const roundStartAt = active.endsAt - ROUND_DURATION_MS;
  const players = await getPlayers(lobbyId);

  const roundScores = new Map<string, number>();
  for (const [playerId, answer] of active.answers) {
    const isCorrect = answer.symbol === active.correctSymbol;
    roundScores.set(playerId, isCorrect ? computeScore(answer.receivedAt, roundStartAt) : 0);
  }

  const scores: PlayerScore[] = await Promise.all(
    players.map(async (player) => {
      const roundScore = roundScores.get(player.playerId) ?? 0;
      const totalScore = await recordScore(lobbyId, player.playerId, roundScore);
      return { playerId: player.playerId, displayName: player.displayName, roundScore, totalScore };
    }),
  );

  scores.sort((a, b) => b.totalScore - a.totalScore);

  io.to(`lobby:${lobbyId}`).emit("game:round_end", {
    correctSymbol: active.correctSymbol,
    scores,
  });

  setTimeout(() => {
    io.to(`lobby:${lobbyId}`).emit("game:over", { finalStandings: scores });
    activeRounds.delete(lobbyId);
  }, RESULTS_DISPLAY_MS);
}
