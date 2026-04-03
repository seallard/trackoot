# Trackoot Project Guide
A real-time, Spotify-integrated social music quiz drawing inspiration from Kahoot.


---

## 1. Core Game Mechanics

### Roles
- **Host**: Opens the lobby on a dedicated screen (TV/laptop). Controls game flow (create lobby, start game). Does not answer questions. Authenticated with Spotify Premium — their account is used for music playback.
- **Player**: Joins from a phone via the lobby PIN. Authenticates with Spotify (any account). Answers questions.

Minimum 2 players required to start a game.

### Game flow
1. Host signs in with Spotify (Premium) and creates a lobby
2. Players sign in with Spotify and join the lobby via PIN
3. Host starts the game — backend generates questions from the already-fetched Spotify data
4. A round starts — question and four answer options are shown on the main screen, music plays
5. Players select an answer on their phone (Triangle / Diamond / Circle / Square)
6. The round ends when the timer expires or all players have answered
7. The correct answer is revealed on the main screen
8. Round scores are shown (points earned this round + cumulative standings)
9. Repeat from step 4 for all rounds
10. Final standings and winner are displayed

### Game state machine
```
LOBBY_WAITING → ROUND_COUNTDOWN → ROUND_ACTIVE → ROUND_RESULTS → [next round or] GAME_OVER
```

### Game parameters
- Round duration: 20 seconds
- Post-round results display: 5 seconds before next round
- Lobby PIN: 6-digit random number
- Max players per lobby: 10
- Min players to start: 2
- Number of rounds: determined by question generation (approx. 1 per player × question types available)

### Scoring
The server records the time it receives the answer — client-provided timestamps are not used.
```
score = correct ? Math.round(1000 * (1 - (serverReceivedMs / roundDurationMs) * 0.5)) : 0
```
Max 1000 points for an instant correct answer; min 500 for a correct answer at time expiry; 0 for incorrect.

### Answer option symbols
Four fixed symbols map to answer slots consistently across all rounds:
- Triangle (red)
- Diamond (blue)
- Circle (yellow)
- Square (green)

If there are fewer than 4 players, fill remaining slots with plausible decoy names.


---

## 2. Question Catalog

Questions are deduplicated — the same artist or track will not appear in more than one question per game.

### Question type schema
Each question type must define:
- **Required Spotify data** — what API data must be present to generate this type
- **Answer options** — how the 4 options are derived
- **Correct answer** — how it is determined from the data
- **Playback** — what audio plays, and timing/behaviour
- **Main screen display** — what text and UI is shown during the round

---

### Who listens most to artist X?
- **Required data**: top artists (medium_term, 50 items) for all players
- **Answer options**: player display names (padded with decoys if < 4 players)
- **Correct answer**: player with the highest-ranked occurrence of artist X in their top-50
- **Playback**: play a popular track by artist X for the full round duration
- **Display**: "Who listens the most to [artist name]?" + artist image

### Who listens most to genre X?
- **Required data**: top artists (medium_term, 50 items) for all players; genres are derived from artist objects
- **Answer options**: player display names (padded with decoys if < 4 players)
- **Correct answer**: player whose top artists contain the highest proportion of genre X
- **Playback**: play a representative track tagged with genre X for the full round duration
- **Display**: "Who listens the most to [genre name]?"

### Who listens most to track X?
- **Required data**: top tracks (medium_term, 50 items) for all players
- **Answer options**: player display names (padded with decoys if < 4 players)
- **Correct answer**: player with the highest-ranked occurrence of track X in their top-50
- **Playback**: play track X for the full round duration
- **Display**: "Who listens the most to [track name]?" + track/album art

### Whose music taste is this?
- **Required data**: top tracks (medium_term, 50 items) for all players
- **Answer options**: player display names (padded with decoys if < 4 players)
- **Correct answer**: the player whose tracks are playing
- **Playback**: play 3–5 short clips (~4s each) from different top tracks of the target player, sequentially
- **Display**: "Whose music taste is this?" — no additional hints shown


---

## 3. Technical Specification

### Spotify data pipeline
Spotify data is fetched eagerly on player join to avoid a slow delay when the host starts the game.

**On player join**: fetch and cache that player's top tracks and top artists (medium_term, 50 items) in Redis under `player:{playerId}:spotify_data`. Genres are derived from artist objects (genres are not present on track objects directly).

**On game start**: all data is already in Redis — run the question generation algorithm immediately using the cached data.

### Music playback
The main screen plays tracks using the **Spotify Web Playback SDK**.
- Requires the host to have a Spotify Premium account
- The host's browser initialises the SDK player on lobby creation and sends the resulting `device_id` to the backend via a `host:player_ready` event
- The backend stores the `device_id` and sends play commands to the Spotify API using the host's stored access token

### Spotify OAuth
The **backend** handles the Spotify OAuth 2.0 Authorization Code flow for both host and players.

- Backend exposes: `GET /auth/spotify` (redirect to Spotify) and `GET /auth/spotify/callback` (exchange code for tokens)
- After successful auth, the backend stores the access token and refresh token in Redis, sets a session cookie, and redirects back to the Next.js app
- Tokens are refreshed automatically by the backend before they expire (Spotify tokens last 1 hour)

**Required scopes:**

| Role | Scopes |
|---|---|
| Host | `streaming`, `user-read-playback-state`, `user-modify-playback-state`, `user-read-private`, `user-top-read` |
| Player | `user-top-read`, `user-read-private` |

**Player identity**: `playerId` is the Spotify user ID (from `GET /me`), used as the stable identifier across Redis keys and Socket.io events.

### Events (Socket.io)

| Event | Direction | Payload |
|---|---|---|
| `player:join` | client → server | `{ lobbyId, playerId, displayName }` |
| `lobby:player_joined` | server → host | `{ player: Player }` |
| `host:player_ready` | client → server | `{ lobbyId, deviceId }` |
| `host:start_game` | client → server | `{ lobbyId }` |
| `game:round_start` | server → all | `{ round: Round, endsAt: timestamp }` |
| `player:submit_answer` | client → server | `{ answerId }` |
| `game:round_end` | server → all | `{ correctAnswerId, scores: PlayerScore[] }` |
| `game:over` | server → all | `{ finalStandings: PlayerScore[] }` |

Note: `player:submit_answer` does not include a client timestamp — the server records its own arrival time for scoring.

### Redis data model
```
lobby:{lobbyId}              Hash   — Lobby metadata (state, hostId, deviceId, config)    TTL: session lifetime
lobby:{lobbyId}:players      Hash   — playerId → Player JSON
lobby:{lobbyId}:scores       ZSet   — playerId → cumulative score (ZADD for leaderboard)
player:{playerId}:token      String — Spotify access token                                 TTL: 1 hour (refreshed automatically)
player:{playerId}:refresh    String — Spotify refresh token                                TTL: session lifetime
player:{playerId}:spotify    String — Cached top tracks + artists JSON (fetched on join)   TTL: session lifetime
```

### Tech stack
Next.js, Node.js, Socket.io, Redis, TypeScript

**Frontend**: Next.js (App Router). Handles UI and static pages. Redirects to the backend for Spotify OAuth. Use Zustand for client-side game state.
- Host UI routes: `/host` (lobby creation), `/host/:lobbyId` (lobby screen + game view)
- Player UI routes: `/join` (enter PIN), `/play/:lobbyId` (answer screen)

**Backend**: Standalone Node.js (TypeScript) server. Responsible for lobby lifecycle, Spotify OAuth, question generation, scoring, and Spotify API calls (playback + data fetch).

**Communication**: Socket.io. Use the `@socket.io/redis-adapter` for multi-instance support.

**Persistence**: Redis as a fast key-value store for active lobby data, player scores, and Spotify tokens.

**Formatting/Linting**: Biome — single tool for both formatting and linting. One `biome.json` at the monorepo root.

**Type safety**: Shared TypeScript interfaces in `packages/types` to synchronise frontend and backend. Enable `strict: true` in all `tsconfig.json` files. Use Zod at system boundaries (Spotify API responses, Socket.io payloads) to validate at runtime and derive TypeScript types via `z.infer<>`. Use discriminated unions for game state.

### Monorepo structure
```
trackoot/
├── apps/
│   ├── web/          # Next.js frontend (host screen + player phone UI)
│   └── server/       # Node.js game engine + Spotify OAuth + Socket.io
├── packages/
│   └── types/        # Shared TypeScript interfaces (Lobby, Player, Round, etc.)
├── package.json      # pnpm workspace root
└── turbo.json        # Turborepo task orchestration
```


---

## 4. Implementation Plan

1. Scaffold monorepo (pnpm + Turborepo), define shared types, set up Redis and Socket.io server
2. Enable a player to join a lobby — host creates lobby, player joins via PIN, host sees join event on main screen
3. Run one game round with a single hardcoded question — define full game state and round flow end-to-end
4. Spotify auth — backend OAuth flow for host (Premium) and players, store tokens, fetch top items on join
5. Question generation from real Spotify data

## External Resources
- **Spotify API Spec:** https://developer.spotify.com/documentation/web-api
- **Spotify Web Playback SDK:** https://developer.spotify.com/documentation/web-playback-sdk
