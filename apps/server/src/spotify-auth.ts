import { z } from "zod";

const ACCOUNTS_URL = "https://accounts.spotify.com";

const HOST_SCOPES = [
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-private",
  "user-top-read",
].join(" ");

const PLAYER_SCOPES = ["user-top-read", "user-read-private"].join(" ");

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
});

export function getAuthUrl(role: "host" | "player", state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: role === "host" ? HOST_SCOPES : PLAYER_SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state,
    // Force the consent screen so the host always explicitly grants the streaming scope.
    // Without this, Spotify silently re-uses a previous grant that may predate the
    // streaming scope being added, resulting in a 403 from the Web Playback SDK.
    show_dialog: "true",
  });
  return `${ACCOUNTS_URL}/authorize?${params}`;
}

async function callTokenEndpoint(
  body: URLSearchParams,
): Promise<z.infer<typeof TokenResponseSchema>> {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(`${ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Spotify token endpoint error: ${res.status} ${await res.text()}`);
  }

  return TokenResponseSchema.parse(await res.json());
}

export async function exchangeCode(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const data = await callTokenEndpoint(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  );

  if (!data.refresh_token) throw new Error("No refresh token returned by Spotify");

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const data = await callTokenEndpoint(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}
