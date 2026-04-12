# Trackoot

A real-time, Spotify-integrated social music quiz — think Kahoot, but your listening history is the question.

Players join a lobby from their phones, music plays through the host's browser, and everyone races to answer questions drawn from the group's Spotify data.

---

## How it works

### Roles

| | Host | Player |
|---|---|---|
| Device | Shared screen (TV / laptop) | Phone |
| Spotify | **Premium required** (runs Web Playback SDK) | Free account works |
| Answers questions | No — controls the game | Yes |

### Game flow

```
LOBBY_WAITING → ROUND_ACTIVE → ROUND_RESULTS → ... → GAME_OVER
```

1. Host signs in with Spotify Premium and creates a lobby.
2. Players sign in and join using the 6-digit PIN shown on the host screen.
3. Host starts the game — questions are generated from the group's cached Spotify data.
4. **Round (20 s)** — a question and four answer symbols appear; music plays through the host's browser. Players tap an answer on their phone.
5. **Results (5 s)** — correct answer is revealed, round scores shown.
6. Repeat for all rounds, then a final leaderboard is displayed.

Scoring rewards speed: a correct answer in the first second scores 1000 points; one at the buzzer scores 500. Wrong answers score 0.

### Question types

- **Whose music taste is this?** — Five of a player's top tracks play back-to-back (4 s each); everyone guesses whose they are.
- **Who listens the most to [artist]?** — Correct answer is whoever has that artist ranked highest in their Spotify top 50.

Questions are generated dynamically from the players in the lobby and deduplicated — the same artist or track never appears twice in one game.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS 4, Framer Motion |
| Client state | Zustand |
| Realtime | Socket.io 4 |
| Backend | Node.js, Express 4 |
| Cache / session store | Redis (ioredis) |
| Validation | Zod |
| Music | Spotify Web API + Web Playback SDK |
| Shared types | `@trackoot/types` (Zod schemas + TypeScript interfaces) |
| Monorepo | Turborepo, pnpm |

---

## Architecture

```
trackoot/
├── apps/
│   ├── web/          # Next.js — host screen + player phone UI
│   └── server/       # Node.js — game engine, Spotify OAuth, Socket.io
└── packages/
    └── types/        # Shared TypeScript interfaces and Zod schemas
```

### Key design decisions

**Shared types package** — `packages/types` is the single source of truth for all Socket.io event payloads, game state shapes, and Zod schemas. Both apps import from it, so the type boundary between client and server is enforced at compile time.

**Zustand as a state machine** — The web client keeps a single Zustand store that mirrors the server-driven game phase (`LOBBY_WAITING → ROUND_ACTIVE → ROUND_RESULTS → GAME_OVER`). Socket.io events mutate the store; React components read from it.

**Server-side timestamps** — Answer timing is recorded when the payload arrives at the server, not when the player taps. This makes scoring tamper-proof with no extra complexity.

**Role-namespaced tokens in Redis** — Host and player OAuth tokens are stored under separate keys (`host:{id}:token` vs `player:{id}:token`), so the same Spotify account can run both roles simultaneously (useful for demos and testing).

**Eager data caching** — Top tracks and artists are fetched from Spotify and cached in Redis the moment a player joins, not at game start. Question generation runs instantly when the host starts the game.

---

## Getting started

### Prerequisites

- Node 20 (`nvm use 20`)
- pnpm
- Redis running locally (`redis-server` or `docker-compose up`)
- A [Spotify Developer app](https://developer.spotify.com/dashboard) with `http://localhost:3001/auth/spotify/callback` in the redirect URI list

### Install and run

```bash
git clone https://github.com/your-org/trackoot
cd trackoot
pnpm install
```

Create `apps/server/.env`:

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3001/auth/spotify/callback
WEB_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
PORT=3001
```

Create `apps/web/.env.local`:

```
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

```bash
pnpm dev
```

Web runs on `http://localhost:3000`, server on `http://localhost:3001`.

See [CLAUDE.md](./CLAUDE.md) for the full environment reference and Spotify scope requirements.

---

## Deployment

The frontend deploys to **Vercel** and the backend (with Redis) deploys to **Railway**. Config files (`railway.toml`, `vercel.json`) are already in the repo.

See [CLAUDE.md § Deployment](./CLAUDE.md#3-deployment) for the full step-by-step walkthrough including how to wire the two services together.
