import { randomUUID } from "node:crypto";
import type { Player } from "@trackoot/types";
import { redis } from "./redis";

const TTL = 60 * 60 * 24; // 24 hours

export async function createLobby(hostId: string): Promise<{ lobbyId: string; pin: string }> {
  const lobbyId = randomUUID();
  const pin = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  await redis.hset(`lobby:${lobbyId}`, { lobbyId, pin, hostId, state: "LOBBY_WAITING" });
  await redis.expire(`lobby:${lobbyId}`, TTL);
  await redis.set(`pin:${pin}`, lobbyId, "EX", TTL);

  return { lobbyId, pin };
}

export async function getLobby(
  lobbyId: string,
): Promise<{ lobbyId: string; pin: string; hostId: string; deviceId?: string } | null> {
  const data = await redis.hgetall(`lobby:${lobbyId}`);
  if (!data?.lobbyId) return null;
  return {
    lobbyId: data.lobbyId,
    pin: data.pin,
    hostId: data.hostId,
    deviceId: data.deviceId ?? undefined,
  };
}

export async function setDeviceId(lobbyId: string, deviceId: string): Promise<void> {
  await redis.hset(`lobby:${lobbyId}`, { deviceId });
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

export async function resetLobby(lobbyId: string): Promise<void> {
  await redis.del(`lobby:${lobbyId}:scores`);
  await redis.hset(`lobby:${lobbyId}`, { state: "LOBBY_WAITING" });
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
