import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@trackoot/types";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001");
  }
  return socket;
}
