import { refreshAccessToken } from "./spotify-auth";
import { redis } from "./redis";

export async function storeTokens(
  role: "host" | "player",
  userId: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await redis.set(`${role}:${userId}:token`, accessToken, "EX", 3600);
  await redis.set(`${role}:${userId}:refresh`, refreshToken);
}

export async function isAuthenticated(role: "host" | "player", userId: string): Promise<boolean> {
  return (await redis.exists(`${role}:${userId}:refresh`)) === 1;
}

export async function getValidToken(role: "host" | "player", userId: string): Promise<string> {
  const token = await redis.get(`${role}:${userId}:token`);
  if (token) return token;

  const refreshToken = await redis.get(`${role}:${userId}:refresh`);
  if (!refreshToken) throw new Error(`No refresh token found for ${role} ${userId}`);

  const { accessToken, expiresIn } = await refreshAccessToken(refreshToken);
  await redis.set(`${role}:${userId}:token`, accessToken, "EX", expiresIn);
  return accessToken;
}
