import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { HostJoinSchema, PlayerJoinSchema } from "@trackoot/types";
import type { ClientToServerEvents, ServerToClientEvents } from "@trackoot/types";
import { addPlayerToLobby, createLobby, getLobby, getLobbyIdByPin } from "./lobby";

const app = express();
const origin = process.env.WEB_URL ?? "http://localhost:3000";

app.use(cors({ origin }));
app.use(express.json());

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

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin },
});

io.on("connection", (socket) => {
  socket.on("host:join", (payload) => {
    const result = HostJoinSchema.safeParse(payload);
    if (!result.success) return;
    socket.join(`lobby:${result.data.lobbyId}`);
  });

  socket.on("player:join", async (payload) => {
    const result = PlayerJoinSchema.safeParse(payload);
    if (!result.success) return;
    const { lobbyId, playerId, displayName } = result.data;
    const player = { playerId, displayName };
    await addPlayerToLobby(lobbyId, player);
    socket.join(`lobby:${lobbyId}`);
    io.to(`lobby:${lobbyId}`).emit("lobby:player_joined", { player });
  });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
