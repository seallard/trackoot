import type { SpotifyPlayerData } from "@trackoot/types";
import { redis } from "./redis";
import { getTopArtists, getTopTracks } from "./spotify-api";
import { getValidToken } from "./token";

const TTL = 60 * 60 * 4; // 4 hours

export async function cachePlayerSpotifyData(playerId: string): Promise<void> {
  const token = await getValidToken(playerId);
  const [topTracks, topArtists] = await Promise.all([getTopTracks(token), getTopArtists(token)]);
  const data: SpotifyPlayerData = { topTracks, topArtists };
  await redis.set(`player:${playerId}:spotify`, JSON.stringify(data), "EX", TTL);
}

export async function getPlayerSpotifyData(playerId: string): Promise<SpotifyPlayerData | null> {
  const raw = await redis.get(`player:${playerId}:spotify`);
  return raw ? (JSON.parse(raw) as SpotifyPlayerData) : null;
}
