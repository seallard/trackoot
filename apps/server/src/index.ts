import { createServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@trackoot/types";

const httpServer = createServer();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
  },
});

// io is typed — handlers will be wired up in subsequent implementation steps
void io;

const PORT = process.env.PORT ?? 3001;

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
