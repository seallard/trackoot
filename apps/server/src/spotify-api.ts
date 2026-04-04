import { z } from "zod";

const MeSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
});

export async function getMe(accessToken: string): Promise<{ id: string; displayName: string }> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Spotify profile: ${res.status}`);
  }

  const data = MeSchema.parse(await res.json());
  return { id: data.id, displayName: data.display_name ?? data.id };
}
