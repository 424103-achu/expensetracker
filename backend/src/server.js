import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { registerSocket, setIO, unregisterSocket } from "./utils/realtime.js";

dotenv.config();

const PORT = Number(process.env.PORT || 5001);
const HOST = process.env.HOST || "0.0.0.0";
const allowedOrigins = (
  process.env.CLIENT_URLS
    ? process.env.CLIENT_URLS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : ["http://localhost:5173"]
);

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

setIO(io);

io.on("connection", (socket) => {
  const userId = Number(socket.handshake.query.userId);
  if (Number.isFinite(userId)) {
    registerSocket(userId, socket.id);
  }

  socket.on("disconnect", () => {
    unregisterSocket(socket.id);
  });
});

server.listen(PORT, HOST, () => {
  const hostForLog = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Expense tracker backend running on http://${hostForLog}:${PORT}`);
});
