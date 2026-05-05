import express from "express";
import Query from "./query.js";
import { aiComplete, extractJSON } from "./aiHelper.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// ─────────────────────────────────────────────────────
// Trending Doubts (#19) — Get most viewed/voted queries
// ─────────────────────────────────────────────────────
router.get("/trending", async (req, res) => {
  try {
    const { subject, limit = 10 } = req.query;
    const filter = subject ? { subject } : {};

    const trending = await Query.find({ ...filter, aiReply: { $exists: true, $ne: "" } })
      .sort({ votes: -1, viewCount: -1 })
      .limit(parseInt(limit))
      .select("queryText subject aiReply votes viewCount tags cluster status timestamp");

    res.json({ success: true, data: trending });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// Vote on a doubt (#20) — Peer Answer Voting
// ─────────────────────────────────────────────────────
router.post("/vote/:queryId", async (req, res) => {
  try {
    const { userId } = req.body;
    const query = await Query.findById(req.params.queryId);
    if (!query) return res.status(404).json({ error: "Doubt not found" });

    // Prevent duplicate votes
    const alreadyVoted = query.votedBy.map(v => v.toString()).includes(userId);
    if (alreadyVoted) {
      query.votes = Math.max(0, query.votes - 1);
      query.votedBy = query.votedBy.filter(v => v.toString() !== userId);
    } else {
      query.votes += 1;
      query.votedBy.push(userId);
    }

    // Auto-mark as trending if votes >= 5
    if (query.votes >= 5) query.isTrending = true;
    
    await query.save();
    res.json({ success: true, votes: query.votes, alreadyVoted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// Track view (#19)
// ─────────────────────────────────────────────────────
router.post("/view/:queryId", async (req, res) => {
  try {
    await Query.findByIdAndUpdate(req.params.queryId, { $inc: { viewCount: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// AI Doubt Clustering (#28)
// ─────────────────────────────────────────────────────
router.post("/cluster", async (req, res) => {
  try {
    const { subject } = req.body;
    const queries = await Query.find({ subject, cluster: { $in: [null, ""] } }).limit(50).select("queryText _id");

    if (!queries.length) return res.json({ success: true, message: "No unclassified doubts" });

    const questionsList = queries.map((q, i) => `${i + 1}. ${q.queryText}`).join("\n");

    const raw = await aiComplete(
      `Cluster these student questions into topic groups. Return JSON:
{"clusters": [{"group": "GroupName", "indices": [1,2,...]}]}`,
      questionsList,
      500
    );
    const result = extractJSON(raw, { clusters: [] });

    // Save clusters to DB
    for (const cluster of result.clusters) {
      for (const idx of cluster.indices) {
        const q = queries[idx - 1];
        if (q) await Query.findByIdAndUpdate(q._id, { cluster: cluster.group });
      }
    }

    res.json({ success: true, clusters: result.clusters });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// All doubts for a subject (for Live Rooms)
// ─────────────────────────────────────────────────────
router.get("/room/:subject", async (req, res) => {
  try {
    const doubts = await Query.find({ subject: req.params.subject })
      .sort({ votes: -1, timestamp: -1 })
      .limit(30)
      .select("queryText aiReply teacherReply votes viewCount toneTag cluster tags status timestamp userId");

    res.json({ success: true, data: doubts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
