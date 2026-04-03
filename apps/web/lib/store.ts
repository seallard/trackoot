import { create } from "zustand";
import type { Player } from "@trackoot/types";

interface LobbyStore {
  pin: string | null;
  players: Player[];
  playerId: string | null;
  displayName: string | null;
  setPin: (pin: string) => void;
  addPlayer: (player: Player) => void;
  setPlayerIdentity: (playerId: string, displayName: string) => void;
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  pin: null,
  players: [],
  playerId: null,
  displayName: null,
  setPin: (pin) => set({ pin }),
  addPlayer: (player) =>
    set((state) => ({
      players: state.players.some((p) => p.playerId === player.playerId)
        ? state.players
        : [...state.players, player],
    })),
  setPlayerIdentity: (playerId, displayName) => set({ playerId, displayName }),
}));
