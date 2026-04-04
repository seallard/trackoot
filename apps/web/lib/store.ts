import { create } from "zustand";
import type { AnswerSymbol, Player, PlayerScore, Round } from "@trackoot/types";

type GamePhase = "waiting" | "round_active" | "round_results" | "game_over";

interface LobbyStore {
  // Auth
  userId: string | null;
  role: "host" | "player" | null;

  // Lobby
  pin: string | null;
  players: Player[];

  // Player identity (userId once authenticated, random UUID before)
  playerId: string | null;
  displayName: string | null;

  // Game state
  gamePhase: GamePhase;
  round: Round | null;
  endsAt: number | null;
  correctSymbol: AnswerSymbol | null;
  scores: PlayerScore[] | null;
  finalStandings: PlayerScore[] | null;
  submittedSymbol: AnswerSymbol | null;

  // Actions
  setAuth: (userId: string, displayName: string, role: "host" | "player") => void;
  setPin: (pin: string) => void;
  addPlayer: (player: Player) => void;
  setPlayerIdentity: (playerId: string, displayName: string) => void;
  startRound: (round: Round, endsAt: number) => void;
  endRound: (correctSymbol: AnswerSymbol, scores: PlayerScore[]) => void;
  endGame: (finalStandings: PlayerScore[]) => void;
  setSubmittedSymbol: (symbol: AnswerSymbol) => void;
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  userId: null,
  role: null,
  pin: null,
  players: [],
  playerId: null,
  displayName: null,
  gamePhase: "waiting",
  round: null,
  endsAt: null,
  correctSymbol: null,
  scores: null,
  finalStandings: null,
  submittedSymbol: null,

  setAuth: (userId, displayName, role) => set({ userId, displayName, playerId: userId, role }),
  setPin: (pin) => set({ pin }),
  addPlayer: (player) =>
    set((state) => ({
      players: state.players.some((p) => p.playerId === player.playerId)
        ? state.players
        : [...state.players, player],
    })),
  setPlayerIdentity: (playerId, displayName) => set({ playerId, displayName }),
  startRound: (round, endsAt) =>
    set({
      gamePhase: "round_active",
      round,
      endsAt,
      correctSymbol: null,
      submittedSymbol: null,
      scores: null,
    }),
  endRound: (correctSymbol, scores) => set({ gamePhase: "round_results", correctSymbol, scores }),
  endGame: (finalStandings) => set({ gamePhase: "game_over", finalStandings }),
  setSubmittedSymbol: (symbol) => set({ submittedSymbol: symbol }),
}));
