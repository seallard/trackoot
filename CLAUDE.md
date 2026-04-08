# Trackoot Project Guide
A real-time, Spotify-integrated social music quiz drawing inspiration from Kahoot.

---

## 1. Commands

```bash
# Requires Node 20 — run once per shell session if not already active
nvm use 20

# Start all apps in dev mode (runs web + server via Turborepo)
pnpm dev

# Type-check all packages
pnpm exec tsc --noEmit -p apps/server/tsconfig.json
pnpm exec tsc --noEmit -p apps/web/tsconfig.json

# Format and lint (auto-fix)
pnpm exec biome check --write
```

---

## 2. Environment Setup

**`apps/server/.env`**
```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://localhost:3001/auth/spotify/callback
WEB_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
PORT=3001
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

Spotify credentials come from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Redis must be running locally (`redis-server`) or via Docker (`docker-compose up`).

---

## 3. Deployment

**Frontend → Vercel, Backend + Redis → Railway**

Config files are already in the repo (`railway.toml`, `vercel.json`). Local dev is unaffected — `pnpm dev` works exactly as before.

### Railway (server)
- New Project → Deploy from GitHub → add Redis plugin (sets `REDIS_URL` automatically)
- Set env vars: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `WEB_URL`, `NODE_ENV=production`
- `PORT` is injected automatically by Railway

### Vercel (web)
- New Project → import repo → Framework: Next.js, Root Directory: `apps/web`
- Set env var: `NEXT_PUBLIC_SERVER_URL`

### Wiring them together
After both are deployed, update each with the other's URL:
- `WEB_URL=https://{vercel-url}` on Railway
- `NEXT_PUBLIC_SERVER_URL=https://{railway-url}` on Vercel
- `SPOTIFY_REDIRECT_URI=https://{railway-url}/auth/spotify/callback` on Railway
- Add that callback URL to the Spotify Developer Dashboard → app → Redirect URIs
- Redeploy both services after updating env vars

---

## 4. Core Game Mechanics

### Roles
- **Host**: Opens the lobby on a dedicated screen (TV/laptop). Controls game flow. Does not answer questions. Requires Spotify Premium — their browser runs the Web Playback SDK for music playback.
- **Player**: Joins from a phone via the lobby PIN. Authenticates with Spotify (free account works). Answers questions.

### Game flow
1. Host signs in with Spotify (Premium) → creates a lobby
2. Players sign in with Spotify → join via PIN
3. Host starts the game — questions are generated from already-cached Spotify data
4. Round starts — question + four answer options shown on main screen, music plays
5. Players select an answer (Triangle / Diamond / Circle / Square)
6. Round ends when timer expires or all players have answered
7. Correct answer revealed, round scores shown
8. Repeat for all rounds → final standings displayed

### Game state machine
```
LOBBY_WAITING → ROUND_ACTIVE → ROUND_RESULTS → [next round or] GAME_OVER
```

### Game parameters
- Round duration: 20 seconds
- Post-round results display: 5 seconds
- Lobby PIN: 6-digit random number
- Min players to start: 1 (dev) — spec says 2 for production
- Number of rounds: generated dynamically (~1 WHOSE_TASTE per non-guest player + artist questions up to MAX_ROUNDS=10)

### Scoring
Server records its own arrival time — client timestamps are never used (prevents cheating).
```
score = correct ? Math.round(1000 * (1 - (serverReceivedMs / roundDurationMs) * 0.5)) : 0
```
Range: 500–1000 for correct answers; 0 for incorrect.

### Answer option symbols
Four fixed symbols, consistent across all rounds:
- Triangle (red) · Diamond (blue) · Circle (yellow) · Square (green)

Fewer than 4 players: remaining slots filled with decoy names.

---

## 5. Question Catalog

### Implementation status
| Type | Status |
|---|---|
| Who listens most to artist X? | ✅ Implemented |
| Whose music taste is this? | ✅ Implemented |
| Who listens most to track X? | 🔲 Defined in types, not yet implemented |
| Who listens most to genre X? | 🔲 Defined in types, not yet implemented |

Questions are deduplicated — the same artist or track will not appear in more than one question per game.

Artist questions are only generated for artists that appear in at least one player's top 50. The correct answer is whoever has the artist at the highest rank. An artist listened to by only one player is a valid (but less interesting) question — consider filtering to artists shared by 2+ players for fairer gameplay.

Guests can join and answer but are never the correct answer (no Spotify data cached for them).

---

### Who listens most to artist X?
- **Required data**: top artists (medium_term, 50 items) for all players
- **Correct answer**: player with highest-ranked occurrence of artist X in their top-50
- **Playback**: top track by artist X for the full round duration
- **Display**: "Who listens the most to [artist name]?" + artist image

### Whose music taste is this?
- **Required data**: top tracks (medium_term, 50 items) — requires ≥5 tracks, so guests are excluded
- **Correct answer**: the player whose tracks are playing
- **Playback**: 5 tracks × 4 seconds each, played sequentially; `game:track_changed` event emitted on each switch
- **Display**: "Whose music taste is this?" + track counter (🎵 2 / 5)

### Who listens most to track X? *(not yet implemented)*
- **Required data**: top tracks (medium_term, 50 items) for all players
- **Correct answer**: player with highest-ranked occurrence of track X in their top-50
- **Playback**: play track X for the full round duration
- **Display**: "Who listens the most to [track name]?" + album art

### Who listens most to genre X? *(not yet implemented)*
- **Required data**: top artists (medium_term, 50 items); genres derived from artist objects
- **Correct answer**: player whose top artists have highest proportion of genre X
- **Playback**: a representative track tagged with genre X
- **Display**: "Who listens the most to [genre name]?"

---

## 6. Technical Specification

### Spotify data pipeline
Data is fetched eagerly on player join to avoid delay at game start.

- **On player join**: fetch and cache top tracks + top artists (medium_term, 50 items) in Redis under `player:{playerId}:spotify`. Genres are derived from artist objects (not available on track objects directly).
- **On game start**: data is already in Redis — question generation runs immediately.

### Music playback
- The host's browser runs the **Spotify Web Playback SDK** (requires Premium + Chrome/Chromium — Widevine DRM)
- On SDK ready, the host emits `host:player_ready` with the `device_id`
- The backend stores `device_id` and issues play/pause commands to the Spotify API using the host's token

### Spotify OAuth
Backend handles the Authorization Code flow for both roles.

- `GET /auth/spotify?role=host|player` → redirects to Spotify
- `GET /auth/spotify/callback` → exchanges code, stores tokens, redirects to frontend with `?userId=&displayName=&role=` params
- `show_dialog=true` is set on host auth to force the consent screen — without this, Spotify silently reuses a previous grant that may predate the `streaming` scope

**Tokens are role-namespaced in Redis.** The same Spotify account can be used as both host and player without overwriting tokens.

**Required scopes:**

| Role | Scopes |
|---|---|
| Host | `streaming`, `user-read-playback-state`, `user-modify-playback-state`, `user-read-private`, `user-top-read` |
| Player | `user-top-read`, `user-read-private` |

**Player identity**: `playerId` = Spotify user ID. Guests use `guest_{random}` and cannot be correct answers.

### Socket.io events

| Event | Direction | Payload |
|---|---|---|
| `host:join` | client → server | `{ lobbyId }` |
| `host:player_ready` | client → server | `{ lobbyId, deviceId }` |
| `host:start_game` | client → server | `{ lobbyId }` |
| `host:reset_game` | client → server | `{ lobbyId }` |
| `player:join` | client → server | `{ lobbyId, playerId, displayName }` |
| `player:submit_answer` | client → server | `{ symbol: AnswerSymbol }` — no client timestamp |
| `lobby:player_joined` | server → all | `{ player: Player }` |
| `lobby:reset` | server → all | `{}` |
| `game:round_start` | server → all | `{ round: Round, endsAt: number, playerCount: number }` |
| `game:round_end` | server → all | `{ correctSymbol: AnswerSymbol, scores: PlayerScore[] }` |
| `game:round_answer_status` | server → all | `{ answeredCount: number, totalPlayers: number }` |
| `game:track_changed` | server → all | `{ trackId: string }` |
| `game:over` | server → all | `{ finalStandings: PlayerScore[] }` |

### Redis data model
```
host:{userId}:token          String — Host Spotify access token              TTL: 1 hour (auto-refreshed)
host:{userId}:refresh        String — Host Spotify refresh token
player:{userId}:token        String — Player Spotify access token            TTL: 1 hour (auto-refreshed)
player:{userId}:refresh      String — Player Spotify refresh token
player:{playerId}:spotify    String — Cached top tracks + artists JSON       TTL: 4 hours
lobby:{lobbyId}              Hash   — Lobby metadata (hostId, pin, deviceId) TTL: 24 hours
lobby:{lobbyId}:players      Hash   — playerId → Player JSON
lobby:{lobbyId}:scores       ZSet   — playerId → cumulative score
pin:{pin}                    String — lobbyId lookup by PIN                  TTL: 24 hours
oauth:state:{state}          String — CSRF nonce for OAuth flow              TTL: 5 minutes
```

### Monorepo structure
```
trackoot/
├── apps/
│   ├── web/          # Next.js (App Router) — host screen + player phone UI
│   └── server/       # Node.js — game engine, Spotify OAuth, Socket.io
├── packages/
│   └── types/        # Shared TypeScript interfaces and Zod schemas
├── biome.json        # Single formatter+linter config for all packages
└── turbo.json        # Turborepo task orchestration
```

### Tech conventions
- **Type safety**: shared types in `packages/types`. Zod at system boundaries (Spotify API responses, Socket.io payloads). `strict: true` everywhere.
- **Client state**: Zustand store in `apps/web/lib/store.ts` — single source of truth for game phase, players, scores.
- **Formatting**: Biome. Run `pnpm exec biome check --write` before committing.
- **Socket reconnection**: both host and player pages re-emit their join event on `socket.on("connect", ...)` to recover room membership after server restarts.

---

## 7. External Resources
- **Spotify API:** https://developer.spotify.com/documentation/web-api
- **Spotify Web Playback SDK:** https://developer.spotify.com/documentation/web-playback-sdk
