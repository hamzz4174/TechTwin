/**
 * ═══════════════════════════════════════════════════════════════
 *  TechTwin — NEURAL LAB ENGINE
 *  5 experimental features that push the boundaries of EdTech.
 * ═══════════════════════════════════════════════════════════════
 *  1. Thought Constellation     POST /nl/constellation
 *  2. Memory Decay Radar        POST /nl/memory-decay
 *  3. Learning Rhythm            POST /nl/rhythm
 *  4. Concept Battlefield        POST /nl/battle
 *  5. AI Mood Chameleon          POST /nl/chameleon
 * ═══════════════════════════════════════════════════════════════
 */

import express from "express";
import LearningProfile from "./learningProfile.js";
import Query from "./query.js";
import User from "./User.js";
import { aiComplete, extractJSON } from "./aiHelper.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();


// ╔═══════════════════════════════════════════════════════════════╗
// ║  1. THOUGHT CONSTELLATION                                    ║
// ║  Maps your learned concepts into an interactive galaxy.       ║
// ╚═══════════════════════════════════════════════════════════════╝

router.post("/constellation", async (req, res) => {
  try {
    const { userId, subject, depth = "detailed" } = req.body;
    if (!subject) return res.status(400).json({ error: "Subject required" });

    let profile = await LearningProfile.findOne({ userId });
    if (!profile) profile = await LearningProfile.create({ userId });

    // Fetch user's past questions for this subject
    const pastQueries = await Query.find({ userId, subject }).sort({ timestamp: -1 }).limit(50);
    const topics = pastQueries.map(q => q.queryText).slice(0, 20);

    const depthMap = {
      overview: "8-10 nodes, 8-12 edges, broad high-level concepts",
      detailed: "12-16 nodes, 15-25 edges, specific topics with sub-concepts",
      deep: "18-25 nodes, 25-40 edges, granular sub-topics and micro-concepts"
    };

    const prompt = `You are a knowledge graph architect. Create a constellation map of concepts for a student studying ${subject}.

STUDENT LEVEL: ${profile.difficultyLevel || "beginner"}
DEPTH: ${depthMap[depth]}

${topics.length > 0 ? `The student has asked about: ${topics.join(", ")}` : "Generate a standard concept map for this subject."}

Return JSON:
{
  "nodes": [
    {"id": 0, "name": "Concept Name", "mastery": 0-100, "cluster": 0-4, "connections": 1-5, "lastStudied": "Today/2 days ago/Never"}
  ],
  "edges": [
    {"from": 0, "to": 1, "strength": 0.1-1.0}
  ],
  "clusters": 3,
  "density": "72%"
}

IMPORTANT: Node IDs must be integers starting at 0. Edges reference node IDs. Mastery 0-100 based on how much the student has studied that concept (use their question history if available). Clusters group related concepts. Strength 0-1 shows how related two concepts are.`;

    const raw = await aiComplete(prompt, `Generate thought constellation for ${subject}`, 1500);
    const constellation = extractJSON(raw, {
      nodes: generateDefaultNodes(subject),
      edges: [],
      clusters: 3,
      density: "50%"
    });

    res.json({ success: true, constellation });
  } catch (err) {
    console.error("❌ Constellation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: default nodes for fallback
function generateDefaultNodes(subject) {
  return [
    { id: 0, name: `${subject} Basics`, mastery: 60, cluster: 0, connections: 3, lastStudied: "Today" },
    { id: 1, name: "Core Concepts", mastery: 45, cluster: 0, connections: 2, lastStudied: "2 days ago" },
    { id: 2, name: "Advanced Topics", mastery: 20, cluster: 1, connections: 2, lastStudied: "Never" },
    { id: 3, name: "Practice Problems", mastery: 55, cluster: 2, connections: 1, lastStudied: "Yesterday" }
  ];
}


// ╔═══════════════════════════════════════════════════════════════╗
// ║  2. MEMORY DECAY RADAR                                       ║
// ║  Ebbinghaus forgetting curve — which memories are fading?     ║
// ╚═══════════════════════════════════════════════════════════════╝

router.post("/memory-decay", async (req, res) => {
  try {
    const { userId, subject } = req.body;
    if (!subject) return res.status(400).json({ error: "Subject required" });

    // Fetch user's question history to calculate decay
    const queries = await Query.find({ userId, subject }).sort({ timestamp: -1 }).limit(100);
    
    // Group by topic/concept
    const topicMap = {};
    queries.forEach(q => {
      const words = q.queryText.split(" ").slice(0, 3).join(" ");
      const key = words.length > 20 ? words.substring(0, 20) : words;
      if (!topicMap[key]) {
        topicMap[key] = { count: 0, lastDate: q.timestamp, dates: [] };
      }
      topicMap[key].count++;
      topicMap[key].dates.push(q.timestamp);
    });

    // If no queries, use AI to generate expected topics
    let items = [];
    if (Object.keys(topicMap).length < 3) {
      const prompt = `List 8 key topics a student studying ${subject} should know. For each, estimate memory retention (0-100) based on common learning patterns.

Return JSON array:
[{"topic": "Topic Name", "retention": 0-100, "lastReviewed": "time ago string", "nextReview": "when string", "reviewCount": 0-5}]`;

      const raw = await aiComplete(prompt, `Memory decay analysis for ${subject}`, 600);
      items = extractJSON(raw, [
        { topic: "Fundamentals", retention: 70, lastReviewed: "2 days ago", nextReview: "Tomorrow", reviewCount: 3 },
        { topic: "Core Concepts", retention: 45, lastReviewed: "1 week ago", nextReview: "Now!", reviewCount: 1 },
        { topic: "Advanced", retention: 20, lastReviewed: "2 weeks ago", nextReview: "Urgently", reviewCount: 0 }
      ]);
    } else {
      // Calculate Ebbinghaus decay for real data
      items = Object.entries(topicMap).map(([topic, data]) => {
        const daysSince = Math.floor((Date.now() - new Date(data.lastDate)) / 86400000);
        const reviews = data.count;
        // Simplified Ebbinghaus: R = e^(-t/S) where S = stability (increases with reviews)
        const stability = 1 + reviews * 1.5;
        const retention = Math.round(Math.exp(-daysSince / stability) * 100);
        
        let nextReview = "In 1 week";
        if (retention < 30) nextReview = "Now!";
        else if (retention < 50) nextReview = "Today";
        else if (retention < 70) nextReview = "Tomorrow";
        else if (retention < 85) nextReview = "In 3 days";

        let lastReviewed = "Unknown";
        if (daysSince === 0) lastReviewed = "Today";
        else if (daysSince === 1) lastReviewed = "Yesterday";
        else if (daysSince < 7) lastReviewed = `${daysSince} days ago`;
        else if (daysSince < 30) lastReviewed = `${Math.floor(daysSince/7)} weeks ago`;
        else lastReviewed = `${Math.floor(daysSince/30)} months ago`;

        return { topic, retention, lastReviewed, nextReview, reviewCount: reviews };
      });
    }

    res.json({ success: true, items, subject });
  } catch (err) {
    console.error("❌ Memory decay error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ╔═══════════════════════════════════════════════════════════════╗
// ║  3. LEARNING RHYTHM ANALYSIS                                  ║
// ║  Discover your biological learning clock.                     ║
// ╚═══════════════════════════════════════════════════════════════╝

router.post("/rhythm", async (req, res) => {
  try {
    const { userId } = req.body;

    // Analyze the timestamps of user's queries
    const queries = await Query.find({ userId }).sort({ timestamp: -1 }).limit(200);
    
    // Build 24-hour activity map
    const hourMap = Array(24).fill(0);
    queries.forEach(q => {
      const hour = new Date(q.timestamp).getHours();
      hourMap[hour]++;
    });

    const total = hourMap.reduce((a, b) => a + b, 0) || 1;
    const peakHour = hourMap.indexOf(Math.max(...hourMap));
    
    const hours = hourMap.map((count, i) => ({
      hour: i,
      activity: Math.round((count / total) * 100),
      label: `${i.toString().padStart(2, '0')}:00`,
      isPeak: i === peakHour
    }));

    // Determine learning type
    const morningActivity = hourMap.slice(6, 12).reduce((a, b) => a + b, 0);
    const eveningActivity = hourMap.slice(18, 24).reduce((a, b) => a + b, 0);
    const learnerType = morningActivity > eveningActivity ? "Morning Bird 🌅" : "Night Owl 🌙";

    // Consistency score
    const activeDays = new Set(queries.map(q => new Date(q.timestamp).toDateString())).size;
    const totalDays = queries.length > 0 
      ? Math.ceil((Date.now() - new Date(queries[queries.length-1].timestamp)) / 86400000)
      : 1;
    const consistency = Math.min(100, Math.round((activeDays / Math.max(totalDays, 1)) * 100));

    res.json({
      success: true,
      hours,
      peakHour,
      learnerType,
      consistency: consistency + "%",
      flowState: Math.round(30 + Math.random() * 40) + "%",
      optimalDuration: "25-40 min",
      totalSessions: queries.length
    });
  } catch (err) {
    console.error("❌ Rhythm error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ╔═══════════════════════════════════════════════════════════════╗
// ║  4. CONCEPT BATTLEFIELD                                       ║
// ║  Two concepts enter, you decide the winner.                   ║
// ╚═══════════════════════════════════════════════════════════════╝

router.post("/battle", async (req, res) => {
  try {
    const { conceptA, conceptB, subject, userId } = req.body;
    if (!conceptA || !conceptB) return res.status(400).json({ error: "Both concepts required" });

    const prompt = `You are a concept comparison battle master for ${subject || "Computer Science"}.

CONCEPT A: ${conceptA}
CONCEPT B: ${conceptB}

Create an entertaining "VS Battle" comparison. Return JSON:
{
  "iconA": "single emoji for concept A",
  "iconB": "single emoji for concept B",
  "descA": "2-sentence description of concept A's strengths (max 120 chars)",
  "descB": "2-sentence description of concept B's strengths (max 120 chars)",
  "scoreA": 40-90 (how useful/powerful concept A is in a percentage),
  "scoreB": 40-90 (how useful/powerful concept B is in a percentage),
  "comparison": "A detailed 3-4 sentence comparison highlighting key differences, using <strong> tags for emphasis",
  "winner": "Which concept wins IN GENERAL (pick one)",
  "question": "A thought-provoking question that tests if the student truly understands when to use each concept"
}`;

    const raw = await aiComplete(prompt, `Battle: ${conceptA} vs ${conceptB}`, 600);
    const battle = extractJSON(raw, {
      iconA: "⚡", iconB: "🔥",
      descA: `${conceptA} is a powerful concept with unique strengths.`,
      descB: `${conceptB} is a versatile concept with broad applications.`,
      scoreA: 60, scoreB: 65,
      comparison: `Both <strong>${conceptA}</strong> and <strong>${conceptB}</strong> have distinct strengths. The choice depends on your specific use case.`,
      winner: conceptB,
      question: `When would you choose ${conceptA} over ${conceptB}, and vice versa?`
    });

    res.json({ success: true, battle });
  } catch (err) {
    console.error("❌ Battle error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ╔═══════════════════════════════════════════════════════════════╗
// ║  5. AI MOOD CHAMELEON                                         ║
// ║  The AI transforms its entire personality based on your mood. ║
// ╚═══════════════════════════════════════════════════════════════╝

router.post("/chameleon", async (req, res) => {
  try {
    const { question, subject, mood, moodPrompt, userId } = req.body;
    if (!question) return res.status(400).json({ error: "Question required" });
    if (!mood) return res.status(400).json({ error: "Mood required" });

    let profile = await LearningProfile.findOne({ userId });
    if (!profile) profile = await LearningProfile.create({ userId });

    const moodPersonas = {
      focused: {
        name: "Zen Master",
        systemPrompt: "You are Zen Master — a precise, no-nonsense tutor. Be concise. Use bullet points. Structure everything clearly. Zero fluff. The student is deeply focused — match their intensity with surgical precision."
      },
      stressed: {
        name: "Calm Guide",
        systemPrompt: "You are Calm Guide — an incredibly gentle, patient tutor. The student is stressed. Start with reassurance. Break everything into tiny, manageable steps. Use simple language. Add encouragement after every point. Be warm and supportive."
      },
      creative: {
        name: "Idea Spark",
        systemPrompt: "You are Idea Spark — a wildly creative tutor. Use unexpected analogies, metaphors from art/music/nature, and storytelling. Make learning feel like discovering art. Be enthusiastic and imaginative. Think outside every box."
      },
      tired: {
        name: "Night Light",
        systemPrompt: "You are Night Light — a gentle bedtime-story-style tutor. The student is tired. Use extremely simple words. Short sentences. Lots of examples. Minimal jargon. Be like a friend explaining something casually. Make it effortless to absorb."
      },
      energized: {
        name: "Hyperdrive",
        systemPrompt: "You are Hyperdrive — a high-energy, challenge-driven tutor. The student is FIRED UP. Match their energy! Go deep, throw challenges, include edge cases, bonus questions, and advanced insights. Push them to think harder!"
      }
    };

    const persona = moodPersonas[mood] || moodPersonas.focused;
    const systemPrompt = `${persona.systemPrompt}

${moodPrompt || ""}

Student Level: ${profile.difficultyLevel || "beginner"}
Subject: ${subject || "general"}

CRITICAL: Your ENTIRE response style must reflect the ${mood} mood. Not just the content — the tone, pacing, vocabulary, and structure should all be adapted.`;

    const answer = await aiComplete(systemPrompt, question, 800);

    // Update profile with mood data
    if (profile) {
      profile.frustrationLevel = mood === "stressed" ? "frustrated" : 
                                   mood === "tired" ? "confused" : "neutral";
      await profile.save();
    }

    res.json({
      success: true,
      answer,
      persona: persona.name,
      mood
    });
  } catch (err) {
    console.error("❌ Chameleon error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


export default router;
