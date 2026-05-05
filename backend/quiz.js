import express from "express";
import Query from "./query.js";
import { aiComplete, extractJSON } from "./aiHelper.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// ─────────────────────────────────────────────────────
// Auto Quiz Generator (#6)
// ─────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const { topic, subject, difficulty = "intermediate", count = 5 } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const systemPrompt = `You are a quiz generator. Generate exactly ${count} multiple choice questions about "${topic}" in "${subject || "general"}".
Return ONLY a valid JSON array:
[
  {
    "question": "Question text?",
    "options": ["A", "B", "C", "D"],
    "answer": "A",
    "explanation": "Short explanation"
  }
]
Difficulty: ${difficulty}. No extra text, only JSON.`;

    const raw = await aiComplete(systemPrompt, `Generate ${count} MCQs on: ${topic} (${subject || "general"})`, 1500);

    const quiz = extractJSON(raw, []);
    if (!quiz.length) return res.status(500).json({ error: "Failed to generate quiz, try again" });

    res.json({ success: true, quiz, topic, difficulty });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// Quiz from AI Reply (auto-generate after answer) (#27)
// ─────────────────────────────────────────────────────
router.post("/from-answer", async (req, res) => {
  try {
    const { queryId, aiReply, subject } = req.body;
    if (!aiReply) return res.status(400).json({ error: "aiReply required" });

    const systemPrompt = `Based on the following educational answer, generate exactly 3 MCQ quiz questions to test understanding.
Return ONLY a JSON array:
[{"question":"?","options":["A","B","C","D"],"answer":"A","explanation":"..."}]`;

    const raw = await aiComplete(systemPrompt, `Answer: ${aiReply}\nSubject: ${subject || "general"}`, 800);

    const quiz = extractJSON(raw, []);

    // Mark query as quiz generated
    if (queryId) {
      try { await Query.findByIdAndUpdate(queryId, { quizGenerated: true }); } catch {}
    }

    res.json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
