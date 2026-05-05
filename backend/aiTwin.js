import express from "express";
import LearningProfile from "./learningProfile.js";
import Query from "./query.js";
import User from "./User.js";
import Notification from "./notification.js";
import { aiComplete, extractJSON } from "./aiHelper.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// ─────────────────────────────────────────────────────
// HELPER: Get or create a learning profile for a user
// ─────────────────────────────────────────────────────
async function getOrCreateProfile(userId) {
  let profile = await LearningProfile.findOne({ userId });
  if (!profile) {
    profile = await LearningProfile.create({ userId });
  }
  return profile;
}

// ─────────────────────────────────────────────────────
// HELPER: Detect confusion/frustration from question text
// ─────────────────────────────────────────────────────
function detectTone(text) {
  const lowered = text.toLowerCase();
  const frustrationWords = ["dont understand", "don't understand", "confusing", "confused", "frustrated", "stuck", "still not", "why not", "nothing makes sense", "what the hell", "i give up", "help me", "please help"];
  const curiousWords = ["why", "how does", "what if", "what happens", "explain more", "tell me more", "can you elaborate"];
  
  let score = 0;
  let tone = "neutral";
  
  for (const w of frustrationWords) {
    if (lowered.includes(w)) { score += 2; tone = "confused"; }
  }
  if (score >= 4) tone = "frustrated";
  for (const w of curiousWords) {
    if (lowered.includes(w) && tone === "neutral") tone = "curious";
  }
  
  return { tone, confusionScore: Math.min(score, 10) };
}

// ─────────────────────────────────────────────────────
// HELPER: Build dynamic prompt based on user level, tone, history
// ─────────────────────────────────────────────────────
function buildDynamicPrompt(question, profile, mode = "default", subject = "") {
  const levelMap = {
    beginner: "Use very simple language, analogies, and avoid jargon. Short paragraphs.",
    intermediate: "Use moderate technical language. Include examples. Balanced depth.",
    advanced: "Use full technical precision, mention edge cases, data structures, algorithms.",
  };

  const toneMap = {
    frustrated: "The student seems frustrated. Be extremely patient, encouraging, and break it into tiny steps.",
    confused: "The student seems confused. Start from absolute basics before answering.",
    curious: "The student is curious. Give a thorough, enthusiastic, detailed answer.",
    neutral: "Give a clear, structured answer.",
  };

  const modeMap = {
    simple: "Explain in the simplest possible way, like you're teaching a child. Use bullet points.",
    technical: "Give a precise, technical, in-depth answer with proper terminology.",
    example: "Answer ONLY with concrete code examples or real step-by-step scenarios.",
    reallife: "Explain with a real-world scenario or everyday analogy. No jargon.",
    whisper: "Answer in 2-3 short bullet points maximum. Ultra concise.",
    default: levelMap[profile?.difficultyLevel || "beginner"],
  };

  const recentContext = profile?.recentTopics?.slice(-3).join(", ");
  
  return `You are TechTwin AI — an adaptive intelligent tutor specialized in ${subject || "technology"}.

Student Level: ${profile?.difficultyLevel || "beginner"}
Teaching Style: ${modeMap[mode] || modeMap.default}
Tone Adjustment: ${toneMap[profile?.frustrationLevel || "neutral"]}
${recentContext ? `Recent Topics: ${recentContext} (use for context)` : ""}

Question: "${question}"

Answer now. Be professional, warm, and educational.`;
}

// ─────────────────────────────────────────────────────
// 1. GET Learning Profile (#1 AI Digital Twin)
// ─────────────────────────────────────────────────────
router.get("/profile/:userId", async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const user = await User.findById(req.params.userId).select("-password");
    res.json({ success: true, data: { profile, user } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 2. Update streak (#10), level, activity
// ─────────────────────────────────────────────────────
router.post("/update-streak/:userId", async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const today = new Date().toDateString();
    const lastDate = profile.lastActiveDate ? new Date(profile.lastActiveDate).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (lastDate !== today) {
      if (lastDate === yesterday) {
        profile.streak += 1;
      } else if (lastDate !== today) {
        profile.streak = 1; // reset
      }
      profile.lastActiveDate = new Date();
      profile.totalDaysActive += 1;
      if (profile.streak > profile.longestStreak) profile.longestStreak = profile.streak;

      // Award XP
      const user = await User.findById(req.params.userId);
      if (user) { user.xpPoints += 10; await user.save(); }

      // Streak milestone notification
      if ([3, 7, 14, 30].includes(profile.streak)) {
        await Notification.create({
          userId: req.params.userId,
          type: "streak",
          icon: "🔥",
          title: "Streak Milestone!",
          message: `🔥 Amazing! You've kept a ${profile.streak}-day learning streak on TechTwin!`,
        });
      }
    }

    await profile.save();
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 3. Pre-Ask AI (#2) — predict next doubts
// ─────────────────────────────────────────────────────
router.get("/pre-ask/:userId", async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const subject = req.query.subject || "technology";
    const lastTopics = profile.recentTopics.slice(-5).join(", ") || subject;

    const raw = await aiComplete(
      "You are a predictive learning engine. Based on a student's recent topics, predict their next 3 likely questions. Return ONLY a JSON array of 3 short question strings.",
      `Subject: ${subject}. Recent topics: ${lastTopics}. Predict next 3 questions.`,
      200
    );

    const suggestions = extractJSON(raw, ["What is this topic's core concept?", "Can you give an example?", "How does this relate to real life?"]);
    res.json({ success: true, suggestions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 4. Multi-Mode AI Answer (#15, #17)
// ─────────────────────────────────────────────────────
router.post("/ask-twin", async (req, res) => {
  try {
    const { question, userId, subject, mode = "default" } = req.body;
    if (!question) return res.status(400).json({ error: "Question required" });

    const profile = await getOrCreateProfile(userId);

    // Detect confusion tone (#4)
    const { tone, confusionScore } = detectTone(question);
    profile.frustrationLevel = tone;

    // Update recent topics
    profile.recentTopics = [...(profile.recentTopics || []).slice(-9), subject || question.split(" ").slice(0, 3).join(" ")];

    // Build dynamic prompt (#29)
    const prompt = buildDynamicPrompt(question, profile, mode, subject);

    // AI Thinking Visualizer - stream steps (#14)
    const steps = [];
    
    // Step 1: Analyze
    steps.push("🔍 Analyzing your question...");
    const answer = await aiComplete(prompt, question, 600);
    steps.push("🧠 Building answer from knowledge base...");
    steps.push("✅ Answer ready!");

    // Update profile scores
    if (subject) {
      const currentScore = profile.subjectScores.get(subject) || 0;
      profile.subjectScores.set(subject, Math.min(currentScore + 5, 100));
    }
    
    // Update adaptive difficulty
    if (confusionScore < 2 && profile.levelScore < 100) {
      profile.levelScore += 5;
      if (profile.levelScore >= 40 && profile.difficultyLevel === "beginner") profile.difficultyLevel = "intermediate";
      if (profile.levelScore >= 80 && profile.difficultyLevel === "intermediate") profile.difficultyLevel = "advanced";
    } else {
      profile.levelScore = Math.max(profile.levelScore - 5, 0);
    }

    await profile.save();

    // AI reply notification
    await Notification.create({
      userId,
      type: "ai_reply",
      icon: "🤖",
      title: "AI Answered Your Doubt",
      message: `Your doubt has been answered 🤖 — "${question.substring(0, 50)}..."`,
    });

    res.json({ success: true, answer, steps, tone, confusionScore, difficultyLevel: profile.difficultyLevel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 5. Instant Revision Mode (#7)
// ─────────────────────────────────────────────────────
router.post("/revision", async (req, res) => {
  try {
    const { subject, userId } = req.body;
    
    // Get last 5 queries for this subject
    const queries = await Query.find({ userId, subject }).sort({ timestamp: -1 }).limit(5);
    if (!queries.length) return res.json({ success: false, message: "No recent doubts found for this subject." });

    const questionsText = queries.map(q => `Q: ${q.queryText}`).join("\n");

    const summary = await aiComplete(
      "Create a concise exam-ready revision summary with key points, definitions, and tips. Use bullet points. Be structured.",
      `Subject: ${subject}\n${questionsText}\nCreate a revision summary.`,
      600
    );
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 6. Concept Dependency Map (#8)
// ─────────────────────────────────────────────────────
router.post("/dependency-map", async (req, res) => {
  try {
    const { topic, subject } = req.body;
    
    const raw = await aiComplete(
      `Return a JSON object with: { "nodes": [{"id":"X","label":"X"},...], "edges": [{"from":"A","to":"B","label":"requires"},...] }. Represent concept dependency map for learning.`,
      `Topic: ${topic} in ${subject}. Show what concepts are required to understand it, and what it unlocks.`,
      400
    );
    const graph = extractJSON(raw, { nodes: [{id: topic, label: topic}], edges: [] });
    res.json({ success: true, graph });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 7. Weakness Radar + Heatmap data (#9, #30)
// ─────────────────────────────────────────────────────
router.get("/heatmap/:userId", async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const queries = await Query.find({ userId: req.params.userId });

    // Build heatmap from query history
    const subjectMap = {};
    queries.forEach(q => {
      if (!subjectMap[q.subject]) subjectMap[q.subject] = { total: 0, confused: 0 };
      subjectMap[q.subject].total++;
      if (q.confusionScore > 3) subjectMap[q.subject].confused++;
    });

    const heatmap = Object.keys(subjectMap).map(sub => ({
      subject: sub,
      strength: Math.round(((subjectMap[sub].total - subjectMap[sub].confused) / subjectMap[sub].total) * 100),
      queries: subjectMap[sub].total,
      confused: subjectMap[sub].confused,
    }));

    const weak = heatmap.filter(h => h.strength < 50).map(h => h.subject);
    const strong = heatmap.filter(h => h.strength >= 75).map(h => h.subject);

    res.json({ success: true, heatmap, weak, strong, streak: profile.streak, xp: profile.xpPoints || 0, level: profile.difficultyLevel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 8. Time-to-Learn Predictor (#27)
// ─────────────────────────────────────────────────────
router.post("/time-predict", async (req, res) => {
  try {
    const { topic, userId } = req.body;
    const profile = await getOrCreateProfile(userId);

    const raw = await aiComplete(
      `You are a learning time predictor. Return JSON: { "days": number, "hours": number, "message": "motivational message" }`,
      `Topic: ${topic}. Student level: ${profile.difficultyLevel}. Avg session: ${profile.avgSessionTime || 30} mins. Predict mastery time.`,
      150
    );
    const prediction = extractJSON(raw, { days: 3, hours: 2, message: "You'll master this in about 3 days with consistent practice!" });
    res.json({ success: true, prediction });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 9. AI Feedback (Self-Improving #16)
// ─────────────────────────────────────────────────────
router.post("/feedback", async (req, res) => {
  try {
    const { userId, questionId, helpful } = req.body;
    const profile = await getOrCreateProfile(userId);
    profile.feedbackGiven.push({ questionId, helpful, date: new Date() });
    await profile.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 10. Update PDF Awareness (#26)
// ─────────────────────────────────────────────────────
router.post("/pdf-context", async (req, res) => {
  try {
    const { userId, pdf, page } = req.body;
    const profile = await getOrCreateProfile(userId);
    profile.currentPDF = pdf;
    profile.currentPage = page;
    if (pdf) profile.pdfProgress.set(pdf, page);
    await profile.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// 11. Smart Study Reminder Suggestion (#25)
// ─────────────────────────────────────────────────────
router.get("/study-suggestion/:userId", async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.params.userId);
    const heatmapRes = await fetch ? null : null; // inline calc
    const queries = await Query.find({ userId: req.params.userId }).sort({ timestamp: -1 }).limit(20);

    const subjectFreq = {};
    queries.forEach(q => { subjectFreq[q.subject] = (subjectFreq[q.subject] || 0) + 1; });
    const sorted = Object.entries(subjectFreq).sort((a, b) => b[1] - a[1]);
    const topSubject = sorted[0]?.[0] || "your current subject";

    const weakTopics = profile.weakTopics.slice(0, 2);
    const suggestion = weakTopics.length
      ? `AI Suggestion: Revise ${weakTopics[0]} today — you've been struggling with it 📚`
      : `AI Suggestion: Revise ${topSubject} today — keep the momentum! 🚀`;

    res.json({ success: true, suggestion, topSubject, weakTopics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
