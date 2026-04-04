import type { Server } from "socket.io";
import type {
  AnswerSymbol,
  ClientToServerEvents,
  Player,
  PlayerScore,
  Round,
  ServerToClientEvents,
  SpotifyPlayerData,
} from "@trackoot/types";
import { getPlayers, recordScore } from "./lobby";
import { generateQuestions, type QuestionEntry } from "./questions";
import { getPlayerSpotifyData } from "./spotify-data";
import { getValidToken } from "./token";

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
  questionQueue: QuestionEntry[];
}

const activeRounds = new Map<string, ActiveRound>();

function computeScore(receivedAt: number, roundStartAt: number): number {
  const serverReceivedMs = receivedAt - roundStartAt;
  return Math.round(1000 * (1 - (serverReceivedMs / ROUND_DURATION_MS) * 0.5));
}

function beginRound(
  io: IoServer,
  lobbyId: string,
  entry: QuestionEntry,
  queue: QuestionEntry[],
  playerCount: number,
): void {
  const endsAt = Date.now() + ROUND_DURATION_MS;
  const timer = setTimeout(() => endRound(io, lobbyId), ROUND_DURATION_MS);

  activeRounds.set(lobbyId, {
    round: entry.round,
    endsAt,
    correctSymbol: entry.correctSymbol,
    answers: new Map(),
    timer,
    ended: false,
    playerCount,
    questionQueue: queue,
  });

  io.to(`lobby:${lobbyId}`).emit("game:round_start", { round: entry.round, endsAt });
}

export async function startRound(io: IoServer, lobbyId: string, players: Player[]): Promise<void> {
  // Fetch cached Spotify data for all players
  const playerDataMap = new Map<string, SpotifyPlayerData>();
  await Promise.all(
    players.map(async (p) => {
      const data = await getPlayerSpotifyData(p.playerId);
      if (data) playerDataMap.set(p.playerId, data);
    }),
  );

  // Need at least one player's token to call the Spotify API
  const tokenPlayerId = players.find((p) => playerDataMap.has(p.playerId))?.playerId;
  if (!tokenPlayerId) {
    console.error(`[${lobbyId}] No cached Spotify data found for any player`);
    return;
  }
  const accessToken = await getValidToken(tokenPlayerId);

  const questions = await generateQuestions(players, playerDataMap, accessToken);
  if (questions.length === 0) {
    console.error(`[${lobbyId}] No questions could be generated`);
    return;
  }

  const [first, ...rest] = questions;
  beginRound(io, lobbyId, first, rest, players.length);
}

export async function recordAnswer(
  io: IoServer,
  lobbyId: string,
  playerId: string,
  symbol: AnswerSymbol,
): Promise<void> {
  const active = activeRounds.get(lobbyId);
  if (!active || active.ended) return;
  if (active.answers.has(playerId)) return;

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

  const [next, ...rest] = active.questionQueue;

  setTimeout(() => {
    if (next) {
      beginRound(io, lobbyId, next, rest, active.playerCount);
    } else {
      io.to(`lobby:${lobbyId}`).emit("game:over", { finalStandings: scores });
      activeRounds.delete(lobbyId);
    }
  }, RESULTS_DISPLAY_MS);
}
