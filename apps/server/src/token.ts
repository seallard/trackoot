import { refreshAccessToken } from "./spotify-auth";
import { redis } from "./redis";

export async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await redis.set(`player:${userId}:token`, accessToken, "EX", 3600);
  await redis.set(`player:${userId}:refresh`, refreshToken);
}

export async function isAuthenticated(userId: string): Promise<boolean> {
  return (await redis.exists(`player:${userId}:refresh`)) === 1;
}

export async function getValidToken(userId: string): Promise<string> {
  const token = await redis.get(`player:${userId}:token`);
  if (token) return token;

  const refreshToken = await redis.get(`player:${userId}:refresh`);
  if (!refreshToken) throw new Error(`No refresh token found for user ${userId}`);

  const { accessToken, expiresIn } = await refreshAccessToken(refreshToken);
  await redis.set(`player:${userId}:token`, accessToken, "EX", expiresIn);
  return accessToken;
}
