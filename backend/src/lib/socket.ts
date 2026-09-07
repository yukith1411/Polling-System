import { Server } from "socket.io";

let io: Server | null = null;

export function setIo(instance: Server) {
  io = instance;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.IO not initialized yet");
  return io;
}

// Room name convention: one room per poll, joined by both the teacher dashboard
// and (optionally) student clients watching live results.
export function pollRoom(pollId: string) {
  return `poll:${pollId}`;
}
