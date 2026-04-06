import { ANSWER_SYMBOLS } from "@trackoot/types";
import type {
  AnswerOption,
  AnswerSymbol,
  Player,
  Round,
  SpotifyArtist,
  SpotifyPlayerData,
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

interface ArtistCandidate {
  artist: SpotifyArtist;
  playerRanks: Array<{ playerId: string; rank: number }>;
}

export async function generateQuestions(
  players: Player[],
  playerDataMap: Map<string, SpotifyPlayerData>,
  accessToken: string,
): Promise<QuestionEntry[]> {
  // Collect all unique artists and each player's rank for them (lower index = higher rank)
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

  // Shuffle first so within each tier the order is random, then sort by player count
  const candidates = shuffle([...artistMap.values()]).sort(
    (a, b) => b.playerRanks.length - a.playerRanks.length,
  );

  const limit = Math.min(players.length * 3, MAX_ROUNDS);
  const selected = candidates.slice(0, limit);

  const questions: QuestionEntry[] = [];

  for (const { artist, playerRanks } of selected) {
    // Correct player: lowest rank index (highest position in their top-50), tie-break alphabetically
    const sorted = [...playerRanks].sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : a.playerId.localeCompare(b.playerId),
    );
    const correctPlayerId = sorted[0].playerId;

    // Get the artist's top track via Spotify API
    const trackId = await getArtistTopTrack(artist.id, accessToken);
    if (!trackId) continue;

    // Shuffle players and assign symbols; pad remaining slots with decoys
    const shuffledPlayers = shuffle([...players]);
    const options: AnswerOption[] = ANSWER_SYMBOLS.map((symbol, i) => {
      const player = shuffledPlayers[i];
      return player
        ? { symbol, label: player.displayName, playerId: player.playerId }
        : { symbol, label: "?", playerId: undefined };
    });

    const correctSymbol = options.find((o) => o.playerId === correctPlayerId)?.symbol;
    if (!correctSymbol) continue; // shouldn't happen, but guard anyway

    questions.push({
      round: {
        roundNumber: questions.length + 1,
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

  return questions;
}
