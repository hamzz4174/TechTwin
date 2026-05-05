import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import speakRoute from "./speak.js";

// Import routes
import authRoutes from "./auth.js";
import lectureRoutes from "./r_lecture.js";
import askRoutes from "./ask.js";
import adminRoutes from "./admin.js";
import smartNotifyRoutes from "./smartNotify.js";
import aiTwinRoutes from "./aiTwin.js";
import quizRoutes from "./quiz.js";
import trendingRoutes from "./trendingDoubt.js";
import worldFirstRoutes from "./worldFirst.js";
import neuralLabRoutes from "./neuralLab.js";

const app = express();
const httpServer = createServer(app);

// ─── WebSocket for Live Doubt Rooms (#18) ───
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

const rooms = new Map(); // subject -> Set of ws clients

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "ws://localhost");
  const subject = url.searchParams.get("subject") || "general";

  if (!rooms.has(subject)) rooms.set(subject, new Set());
  rooms.get(subject).add(ws);

  const count = rooms.get(subject).size;
  // Notify room of new member
  broadcast(subject, { type: "join", count, subject });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      broadcast(subject, { ...msg, type: msg.type || "message", subject });
    } catch {}
  });

  ws.on("close", () => {
    rooms.get(subject)?.delete(ws);
    broadcast(subject, { type: "leave", count: rooms.get(subject)?.size || 0, subject });
  });
});

function broadcast(subject, data) {
  const room = rooms.get(subject);
  if (!room) return;
  const payload = JSON.stringify(data);
  room.forEach(client => {
    if (client.readyState === 1) client.send(payload);
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/lecture", lectureRoutes);
app.use("/ask", askRoutes);
app.use("/admin", adminRoutes);
app.use("/notifications", smartNotifyRoutes);
app.use("/speak", speakRoute);

// NEW FEATURE ROUTES
app.use("/twin", aiTwinRoutes);
app.use("/quiz", quizRoutes);
app.use("/trending", trendingRoutes);
app.use("/wf", worldFirstRoutes);
app.use("/nl", neuralLabRoutes);

// Serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// Start server (HTTP + WS on same port)
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 TechTwin Server running on port ${PORT}`);
  console.log(`🔌 WebSocket Live Rooms ready at ws://localhost:${PORT}/ws`);
});