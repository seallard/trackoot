import { randomUUID } from "node:crypto";
import type { Player } from "@trackoot/types";
import { redis } from "./redis";

const TTL = 60 * 60 * 24; // 24 hours

export async function createLobby(): Promise<{ lobbyId: string; pin: string }> {
  const lobbyId = randomUUID();
  const pin = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  await redis.hset(`lobby:${lobbyId}`, { lobbyId, pin, state: "LOBBY_WAITING" });
  await redis.expire(`lobby:${lobbyId}`, TTL);
  await redis.set(`pin:${pin}`, lobbyId, "EX", TTL);

  return { lobbyId, pin };
}

export async function getLobby(lobbyId: string): Promise<{ lobbyId: string; pin: string } | null> {
  const data = await redis.hgetall(`lobby:${lobbyId}`);
  if (!data?.lobbyId) return null;
  return { lobbyId: data.lobbyId, pin: data.pin };
}

export async function getLobbyIdByPin(pin: string): Promise<string | null> {
  return redis.get(`pin:${pin}`);
}

export async function addPlayerToLobby(lobbyId: string, player: Player): Promise<void> {
  await redis.hset(`lobby:${lobbyId}:players`, player.playerId, JSON.stringify(player));
}

export async function getPlayers(lobbyId: string): Promise<Player[]> {
  const data = await redis.hgetall(`lobby:${lobbyId}:players`);
  if (!data) return [];
  return Object.values(data).map((json) => JSON.parse(json) as Player);
}

export async function recordScore(
  lobbyId: string,
  playerId: string,
  score: number,
): Promise<number> {
  await redis.zincrby(`lobby:${lobbyId}:scores`, score, playerId);
  const total = await redis.zscore(`lobby:${lobbyId}:scores`, playerId);
  return Number(total ?? 0);
}
