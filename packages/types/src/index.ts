import { z } from "zod";

// ---- Answer Symbols ----

export const ANSWER_SYMBOLS = ["triangle", "diamond", "circle", "square"] as const;
export type AnswerSymbol = (typeof ANSWER_SYMBOLS)[number];

export interface AnswerOption {
  symbol: AnswerSymbol;
  label: string; // player display name or decoy
  playerId?: string; // undefined for decoys
}

// ---- Players ----

export interface Player {
  playerId: string; // Spotify user ID
  displayName: string;
}

// ---- Spotify Data (cached per player) ----

export interface SpotifyTrack {
  id: string;
  name: string;
  albumArtUrl?: string;
  artistId: string;
  artistName: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  imageUrl?: string;
  genres: string[];
}

export interface SpotifyPlayerData {
  topTracks: SpotifyTrack[]; // up to 50, medium_term
  topArtists: SpotifyArtist[]; // up to 50, medium_term
}

export interface PlayerScore {
  playerId: string;
  displayName: string;
  roundScore: number;
  totalScore: number;
}

// ---- Questions (discriminated union) ----

export type Question =
  | {
      type: "WHO_LISTENS_MOST_ARTIST";
      artistId: string;
      artistName: string;
      artistImageUrl?: string;
      trackId: string; // track to play during round
    }
  | {
      type: "WHO_LISTENS_MOST_GENRE";
      genre: string;
      trackId: string; // representative track to play
    }
  | {
      type: "WHO_LISTENS_MOST_TRACK";
      trackId: string;
      trackName: string;
      albumArtUrl?: string;
    }
  | {
      type: "WHOSE_TASTE";
      trackIds: string[]; // 3–5 track IDs played sequentially (~4s each)
    };

// ---- Rounds ----

export interface Round {
  roundNumber: number;
  question: Question;
  options: AnswerOption[];
}

// ---- Game State (discriminated union) ----

export type GameState =
  | { status: "LOBBY_WAITING" }
  | { status: "ROUND_COUNTDOWN"; round: Round; startsAt: number }
  | { status: "ROUND_ACTIVE"; round: Round; endsAt: number }
  | {
      status: "ROUND_RESULTS";
      round: Round;
      correctSymbol: AnswerSymbol;
      scores: PlayerScore[];
    }
  | { status: "GAME_OVER"; finalStandings: PlayerScore[] };

// ---- Lobby ----

export interface Lobby {
  lobbyId: string;
  pin: string; // 6-digit string
  hostId: string; // Spotify user ID of host
  deviceId?: string; // Spotify Web Playback SDK device ID, set after host:player_ready
  state: GameState;
  players: Player[];
}

// ---- Socket.io Event Payloads ----

export interface HostResetGamePayload {
  lobbyId: string;
}

// Client → Server
export interface PlayerJoinPayload {
  lobbyId: string;
  playerId: string;
  displayName: string;
}

export interface HostPlayerReadyPayload {
  lobbyId: string;
  deviceId: string;
}

export interface HostStartGamePayload {
  lobbyId: string;
}

export interface PlayerSubmitAnswerPayload {
  symbol: AnswerSymbol; // no client timestamp — server records arrival time for scoring
}

export interface HostJoinPayload {
  lobbyId: string;
}

// Server → Client
export interface LobbyPlayerJoinedPayload {
  player: Player;
}

export interface GameRoundStartPayload {
  round: Round;
  endsAt: number; // Unix timestamp ms
}

export interface GameRoundEndPayload {
  correctSymbol: AnswerSymbol;
  scores: PlayerScore[];
}

export interface GameOverPayload {
  finalStandings: PlayerScore[];
}

// ---- Socket.io Typed Event Maps ----

export interface ServerToClientEvents {
  "lobby:player_joined": (payload: LobbyPlayerJoinedPayload) => void;
  "lobby:reset": () => void;
  "game:round_start": (payload: GameRoundStartPayload) => void;
  "game:round_end": (payload: GameRoundEndPayload) => void;
  "game:over": (payload: GameOverPayload) => void;
}

export interface ClientToServerEvents {
  "host:join": (payload: HostJoinPayload) => void;
  "player:join": (payload: PlayerJoinPayload) => void;
  "host:player_ready": (payload: HostPlayerReadyPayload) => void;
  "host:start_game": (payload: HostStartGamePayload) => void;
  "host:reset_game": (payload: HostResetGamePayload) => void;
  "player:submit_answer": (payload: PlayerSubmitAnswerPayload) => void;
}

// ---- Zod Schemas (runtime validation at system boundaries) ----

export const PlayerJoinSchema = z.object({
  lobbyId: z.string(),
  playerId: z.string(),
  displayName: z.string().min(1).max(30),
});

export const HostPlayerReadySchema = z.object({
  lobbyId: z.string(),
  deviceId: z.string(),
});

export const HostStartGameSchema = z.object({
  lobbyId: z.string(),
});

export const PlayerSubmitAnswerSchema = z.object({
  symbol: z.enum(ANSWER_SYMBOLS),
});

export const HostJoinSchema = z.object({
  lobbyId: z.string(),
});

export const HostResetGameSchema = z.object({
  lobbyId: z.string(),
});
