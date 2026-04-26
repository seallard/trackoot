import { ANSWER_SYMBOLS } from "@trackoot/types";
import type {
  AnswerOption,
  AnswerSymbol,
  Player,
  Round,
  SpotifyArtist,
  SpotifyPlayerData,
  SpotifyTrack,
} from "@trackoot/types";
import { getArtistTopTrack } from "./spotify-api";

const MAX_ROUNDS = 10;

export interface QuestionEntry {
  round: Round;
  correctSymbol: AnswerSymbol;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOptions(players: Player[]): {
  options: AnswerOption[];
  correctFor: (playerId: string) => AnswerSymbol | undefined;
} {
  const shuffled = shuffle([...players]);
  const options: AnswerOption[] = ANSWER_SYMBOLS.map((symbol, i) => {
    const p = shuffled[i];
    return p
      ? { symbol, label: p.displayName, playerId: p.playerId }
      : { symbol, label: "?", playerId: undefined };
  });
  return {
    options,
    correctFor: (id) => options.find((o) => o.playerId === id)?.symbol,
  };
}

interface ArtistCandidate {
  artist: SpotifyArtist;
  playerRanks: Array<{ playerId: string; rank: number }>;
}

interface TrackCandidate {
  track: SpotifyTrack;
  playerRanks: Array<{ playerId: string; rank: number }>;
}

function generateWhoseTasteEntries(
  players: Player[],
  playerDataMap: Map<string, SpotifyPlayerData>,
): QuestionEntry[] {
  const entries: QuestionEntry[] = [];

  for (const player of players) {
    if (player.isGuest) continue;
    const data = playerDataMap.get(player.playerId);
    if (!data || data.topTracks.length < 5) continue;

    const trackIds = shuffle([...data.topTracks])
      .slice(0, 5)
      .map((t) => t.id);

    const { options, correctFor } = buildOptions(players);
    const correctSymbol = correctFor(player.playerId);
    if (!correctSymbol) continue;

    entries.push({
      round: { roundNumber: 0, question: { type: "WHOSE_TASTE", trackIds }, options },
      correctSymbol,
    });
  }

  return entries;
}

function generateWhoListensMostTrackEntries(
  players: Player[],
  playerDataMap: Map<string, SpotifyPlayerData>,
  budget: number,
): QuestionEntry[] {
  const nonGuestCount = players.filter((p) => !p.isGuest).length;
  const minShared = Math.min(4, nonGuestCount);

  const trackMap = new Map<string, TrackCandidate>();
  for (const player of players) {
    const data = playerDataMap.get(player.playerId);
    if (!data) continue;
    for (let i = 0; i < data.topTracks.length; i++) {
      const track = data.topTracks[i];
      const existing = trackMap.get(track.id);
      if (existing) {
        existing.playerRanks.push({ playerId: player.playerId, rank: i });
      } else {
        trackMap.set(track.id, { track, playerRanks: [{ playerId: player.playerId, rank: i }] });
      }
    }
  }

  // Only tracks shared by enough players
  const candidates = [...trackMap.values()].filter((c) => c.playerRanks.length >= minShared);

  // Round-robin by correct player for fairness
  const byPlayer = new Map<string, TrackCandidate[]>();
  for (const candidate of shuffle(candidates)) {
    const sorted = [...candidate.playerRanks].sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : a.playerId.localeCompare(b.playerId),
    );
    const correctPlayerId = sorted[0].playerId;
    const bucket = byPlayer.get(correctPlayerId) ?? [];
    bucket.push(candidate);
    byPlayer.set(correctPlayerId, bucket);
  }

  const selected: TrackCandidate[] = [];
  const buckets = [...byPlayer.values()];
  let bucketIndex = 0;
  while (selected.length < budget) {
    let added = false;
    for (const bucket of buckets) {
      if (bucketIndex < bucket.length && selected.length < budget) {
        selected.push(bucket[bucketIndex]);
        added = true;
      }
    }
    if (!added) break;
    bucketIndex++;
  }

  const entries: QuestionEntry[] = [];
  for (const { track, playerRanks } of selected) {
    const sorted = [...playerRanks].sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : a.playerId.localeCompare(b.playerId),
    );
    const correctPlayerId = sorted[0].playerId;
    const { options, correctFor } = buildOptions(players);
    const correctSymbol = correctFor(correctPlayerId);
    if (!correctSymbol) continue;
    entries.push({
      round: {
        roundNumber: 0,
        question: {
          type: "WHO_LISTENS_MOST_TRACK",
          trackId: track.id,
          trackName: track.name,
          albumArtUrl: track.albumArtUrl,
        },
        options,
      },
      correctSymbol,
    });
  }
  return entries;
}

export async function generateQuestions(
  players: Player[],
  playerDataMap: Map<string, SpotifyPlayerData>,
  accessToken: string,
): Promise<QuestionEntry[]> {
  // --- WHOSE_TASTE pool: one per non-guest player with enough tracks ---
  const tasteEntries = generateWhoseTasteEntries(players, playerDataMap);

  // --- WHO_LISTENS_MOST_ARTIST pool ---
  const artistMap = new Map<string, ArtistCandidate>();

  for (const player of players) {
    const data = playerDataMap.get(player.playerId);
    if (!data) continue;
    for (let i = 0; i < data.topArtists.length; i++) {
      const artist = data.topArtists[i];
      const existing = artistMap.get(artist.id);
      if (existing) {
        existing.playerRanks.push({ playerId: player.playerId, rank: i });
      } else {
        artistMap.set(artist.id, { artist, playerRanks: [{ playerId: player.playerId, rank: i }] });
      }
    }
  }

  const remainingAfterTaste = MAX_ROUNDS - tasteEntries.length;
  const artistLimit = Math.min(players.length * 3, Math.floor(remainingAfterTaste / 2));

  // Pre-compute correct player for each candidate, then group by player and
  // round-robin pick so each player is the correct answer roughly equally often.
  const byPlayer = new Map<string, ArtistCandidate[]>();
  for (const candidate of shuffle([...artistMap.values()])) {
    const sorted = [...candidate.playerRanks].sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : a.playerId.localeCompare(b.playerId),
    );
    const correctPlayerId = sorted[0].playerId;
    const bucket = byPlayer.get(correctPlayerId) ?? [];
    bucket.push(candidate);
    byPlayer.set(correctPlayerId, bucket);
  }

  const selected: ArtistCandidate[] = [];
  const buckets = [...byPlayer.values()];
  let bucketIndex = 0;
  while (selected.length < artistLimit) {
    let added = false;
    for (const bucket of buckets) {
      if (bucketIndex < bucket.length && selected.length < artistLimit) {
        selected.push(bucket[bucketIndex]);
        added = true;
      }
    }
    if (!added) break;
    bucketIndex++;
  }

  const artistEntries: QuestionEntry[] = [];

  for (const { artist, playerRanks } of selected) {
    const sorted = [...playerRanks].sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : a.playerId.localeCompare(b.playerId),
    );
    const correctPlayerId = sorted[0].playerId;

    const trackId = await getArtistTopTrack(artist.id, accessToken);
    if (!trackId) continue;

    const { options, correctFor } = buildOptions(players);
    const correctSymbol = correctFor(correctPlayerId);
    if (!correctSymbol) continue;

    artistEntries.push({
      round: {
        roundNumber: 0,
        question: {
          type: "WHO_LISTENS_MOST_ARTIST",
          artistId: artist.id,
          artistName: artist.name,
          artistImageUrl: artist.imageUrl,
          trackId,
        },
        options,
      },
      correctSymbol,
    });
  }

  // --- WHO_LISTENS_MOST_TRACK pool ---
  const trackBudget = MAX_ROUNDS - tasteEntries.length - artistEntries.length;
  const trackEntries = generateWhoListensMostTrackEntries(players, playerDataMap, trackBudget);

  // Combine, shuffle, and assign final round numbers
  const all = shuffle([...tasteEntries, ...artistEntries, ...trackEntries]);
  for (let i = 0; i < all.length; i++) {
    all[i].round.roundNumber = i + 1;
  }
  return all;
}
