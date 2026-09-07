import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { setIo, pollRoom } from "./lib/socket";
import { computePollResults } from "./lib/results";

import authRoutes from "./routes/auth";
import classesRoutes from "./routes/classes";
import pollsRoutes from "./routes/polls";
import publicRoutes from "./routes/public";
import adminRoutes from "./routes/admin";

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_ORIGINS = [...new Set([FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"])]
const isAllowedOrigin = (origin?: string) =>
  !origin || FRONTEND_ORIGINS.includes(origin) || /^https:\/\/[^/]+\.(ngrok\.app|ngrok-free\.app)$/.test(origin);

app.use(cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin) ? origin : false), credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/classes", classesRoutes);
app.use("/api/polls", pollsRoutes);
app.use("/api/public/polls", publicRoutes);
app.use("/api/admin", adminRoutes);

// 404 + error handling
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const io = new Server(server, { cors: { origin: (origin, callback) => callback(null, isAllowedOrigin(origin) ? origin : false) } });
setIo(io);

io.on("connection", (socket) => {
  // Teacher dashboards (and optionally students) join a poll's room to get live updates.
  socket.on("poll:join", async (pollId: string) => {
    socket.join(pollRoom(pollId));
    const results = await computePollResults(pollId);
    if (results) socket.emit("poll:results", results);
  });
  socket.on("poll:leave", (pollId: string) => {
    socket.leave(pollRoom(pollId));
  });
});

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`Polling backend listening on http://localhost:${PORT}`);
});
