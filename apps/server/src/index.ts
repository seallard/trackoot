import "dotenv/config";
import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import {
  HostJoinSchema,
  HostStartGameSchema,
  PlayerJoinSchema,
  PlayerSubmitAnswerSchema,
} from "@trackoot/types";
import type { ClientToServerEvents, ServerToClientEvents } from "@trackoot/types";
import authRouter from "./auth";
import { recordAnswer, startRound } from "./game";
import { addPlayerToLobby, createLobby, getLobby, getLobbyIdByPin, getPlayers } from "./lobby";
import { cachePlayerSpotifyData } from "./spotify-data";

interface SocketData {
  playerId?: string;
  lobbyId?: string;
}

const app = express();
const origin = process.env.WEB_URL ?? "http://localhost:3000";

app.use(cors({ origin }));
app.use(express.json());

app.use("/auth", authRouter);

app.post("/lobbies", async (_req, res) => {
  const result = await createLobby();
  res.json(result);
});

// More specific route must come before /:lobbyId
app.get("/lobbies/pin/:pin", async (req, res) => {
  const lobbyId = await getLobbyIdByPin(req.params.pin);
  if (!lobbyId) {
    res.status(404).json({ error: "Invalid PIN" });
    return;
  }
  res.json({ lobbyId });
});

app.get("/lobbies/:lobbyId", async (req, res) => {
  const lobby = await getLobby(req.params.lobbyId);
  if (!lobby) {
    res.status(404).json({ error: "Lobby not found" });
    return;
  }
  res.json(lobby);
});

const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, { cors: { origin, credentials: true } });

io.on("connection", (socket) => {
  socket.on("host:join", (payload) => {
    const result = HostJoinSchema.safeParse(payload);
    if (!result.success) return;
    socket.data.lobbyId = result.data.lobbyId;
    socket.join(`lobby:${result.data.lobbyId}`);
  });

  socket.on("player:join", async (payload) => {
    const result = PlayerJoinSchema.safeParse(payload);
    if (!result.success) return;
    const { lobbyId, playerId, displayName } = result.data;
    socket.data.playerId = playerId;
    socket.data.lobbyId = lobbyId;
    const player = { playerId, displayName };
    await addPlayerToLobby(lobbyId, player);
    cachePlayerSpotifyData(playerId).catch((err) =>
      console.error(`Failed to cache Spotify data for ${playerId}:`, err),
    );
    socket.join(`lobby:${lobbyId}`);
    io.to(`lobby:${lobbyId}`).emit("lobby:player_joined", { player });
  });

  socket.on("host:start_game", async (payload) => {
    const result = HostStartGameSchema.safeParse(payload);
    if (!result.success) return;
    const { lobbyId } = result.data;
    const players = await getPlayers(lobbyId);
    if (players.length < 1) return;
    await startRound(io, lobbyId, players);
  });

  socket.on("player:submit_answer", async (payload) => {
    const result = PlayerSubmitAnswerSchema.safeParse(payload);
    if (!result.success) return;
    const { playerId, lobbyId } = socket.data;
    if (!playerId || !lobbyId) return;
    await recordAnswer(io, lobbyId, playerId, result.data.symbol);
  });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
