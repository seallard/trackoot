import { z } from "zod";
import type { SpotifyArtist, SpotifyTrack } from "@trackoot/types";

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

const TrackItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  album: z.object({ images: z.array(z.object({ url: z.string() })) }),
  artists: z.array(z.object({ id: z.string(), name: z.string() })),
});

const ArtistItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  images: z.array(z.object({ url: z.string() })),
  genres: z.array(z.string()),
});

const TopTracksResponseSchema = z.object({ items: z.array(TrackItemSchema) });
const TopArtistsResponseSchema = z.object({ items: z.array(ArtistItemSchema) });

async function fetchTopItems(accessToken: string, type: "tracks" | "artists"): Promise<Response> {
  return fetch(`https://api.spotify.com/v1/me/top/${type}?limit=50&time_range=medium_term`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getTopTracks(accessToken: string): Promise<SpotifyTrack[]> {
  const res = await fetchTopItems(accessToken, "tracks");
  if (!res.ok) throw new Error(`Failed to fetch top tracks: ${res.status}`);
  const { items } = TopTracksResponseSchema.parse(await res.json());
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    albumArtUrl: item.album.images[0]?.url,
    artistId: item.artists[0].id,
    artistName: item.artists[0].name,
  }));
}

export async function getTopArtists(accessToken: string): Promise<SpotifyArtist[]> {
  const res = await fetchTopItems(accessToken, "artists");
  if (!res.ok) throw new Error(`Failed to fetch top artists: ${res.status}`);
  const { items } = TopArtistsResponseSchema.parse(await res.json());
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    imageUrl: item.images[0]?.url,
    genres: item.genres,
  }));
}

const ArtistTopTracksSchema = z.object({
  tracks: z.array(z.object({ id: z.string() })),
});

export async function getArtistTopTrack(
  artistId: string,
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=from_token`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const { tracks } = ArtistTopTracksSchema.parse(await res.json());
  return tracks[0]?.id ?? null;
}
