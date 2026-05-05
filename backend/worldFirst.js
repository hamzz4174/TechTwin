/**
 * ═══════════════════════════════════════════════════════════════
 *  TechTwin — WORLD-FIRST FEATURES ENGINE
 *  7 features that don't exist anywhere on Earth.
 * ═══════════════════════════════════════════════════════════════
 *  1. AI Personal Textbook        POST /wf/textbook/generate
 *  2. Voice Emotion Mirror        POST /wf/voice-emotion/ask
 *  3. Teacher Style Cloning       GET  /wf/teacher-style/teachers
 *                                 POST /wf/teacher-style/ask
 *  4. Exam Reverse-Engineering    POST /wf/exam-reverse/analyze
 *                                 POST /wf/exam-reverse/mock
 *  5. Live Lecture Co-Pilot       POST /wf/lecture/im-lost
 *                                 POST /wf/lecture/summary
 *  6. Silent Misunderstanding     POST /wf/probe/generate
 *     Scanner (SURPRISE)          POST /wf/probe/evaluate
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
// ║  1. AI PERSONAL TEXTBOOK — A book written ONLY for you       ║
// ╚═══════════════════════════════════════════════════════════════╝

router.post("/textbook/generate", async (req, res) => {
  try {
    const { userId, subject, chapters = [], preferredStyle = "balanced" } = req.body;
    if (!subject) return res.status(400).json({ error: "Subject required" });

    // Fetch student profile for personalization
    let profile = await LearningProfile.findOne({ userId });
    if (!profile) profile = await LearningProfile.create({ userId });

    const user = await User.findById(userId).select("-password");

    // Fetch past queries for this subject to personalize content
    const pastQueries = await Query.find({ userId, subject }).sort({ timestamp: -1 }).limit(30);
    const studentQuestions = pastQueries.map(q => q.queryText).slice(0, 10);
    const weakAreas = [];
    const strongAreas = [];

    // Determine weak/strong from subject scores
    if (profile.subjectScores) {
      for (const [topic, score] of profile.subjectScores.entries()) {
        if (score < 50) weakAreas.push(topic);
        else if (score >= 75) strongAreas.push(topic);
      }
    }

    // Style descriptions
    const styleMap = {
      "code-first": "Always lead with code examples before theory. Use programming analogies.",
      "visual": "Use diagrams described in text, real-world visual analogies, and metaphors. Make concepts visual.",
      "analogy": "Explain everything through real-life analogies — sports, cooking, building, games.",
      "formal": "Use textbook-style formal language with proper definitions and theorems.",
      "balanced": "Mix code examples, analogies, and formal definitions evenly."
    };

    const chaptersToGenerate = chapters.length > 0 ? chapters : [subject];

    const generatedChapters = [];

    for (let i = 0; i < chaptersToGenerate.length; i++) {
      const chapterTopic = chaptersToGenerate[i];
      const isWeak = weakAreas.some(w => chapterTopic.toLowerCase().includes(w.toLowerCase()));
      const isStrong = strongAreas.some(s => chapterTopic.toLowerCase().includes(s.toLowerCase()));

      const depth = isWeak ? "DEEP" : isStrong ? "BRIEF" : "MODERATE";
      const depthInstruction = {
        DEEP: "This is a WEAK topic for the student. Write a very detailed, 5-section chapter with extra examples, step-by-step breakdowns, and common mistakes to avoid. Be thorough.",
        BRIEF: "This is a STRONG topic. Write a concise 2-section summary with key points only. Don't over-explain.",
        MODERATE: "Standard depth. 3-4 sections with good examples and clear explanations."
      };

      // Build personalized chapter prompt
      const relatedQuestions = studentQuestions.filter(q =>
        q.toLowerCase().includes(chapterTopic.toLowerCase().split(" ")[0])
      );

      const chapterPrompt = `You are writing Chapter ${i + 1} of a PERSONALIZED textbook for a student named "${user?.name || 'Student'}".

SUBJECT: ${subject}
CHAPTER TOPIC: ${chapterTopic}
STUDENT LEVEL: ${profile.difficultyLevel || "beginner"}
TEACHING STYLE: ${styleMap[preferredStyle] || styleMap.balanced}
DEPTH: ${depthInstruction[depth]}

${relatedQuestions.length > 0 ? `The student has previously asked these questions about this topic (address them in the chapter):
${relatedQuestions.map(q => `- "${q}"`).join("\n")}` : ""}

Write the chapter in Markdown format with:
- A chapter title with emoji
- An opening paragraph addressing the student by name
- Clear sections with headers (##)
- Code examples in \`\`\` blocks if relevant
- A "Key Takeaways" section at the end
- 3 practice questions at the end

Write naturally, as if you're a personal tutor writing a book JUST for this student.`;

      const chapterContent = await aiComplete(chapterPrompt, `Generate Chapter ${i + 1}: ${chapterTopic}`, 2000);

      generatedChapters.push({
        chapterNumber: i + 1,
        title: chapterTopic,
        content: chapterContent,
        depth,
        isPersonalized: relatedQuestions.length > 0
      });
    }

    // Generate table of contents
    const toc = generatedChapters.map(ch => ({
      number: ch.chapterNumber,
      title: ch.title,
      depth: ch.depth
    }));

    res.json({
      success: true,
      textbook: {
        title: `${subject} — A Personal Textbook for ${user?.name || "You"}`,
        studentName: user?.name || "Student",
        subject,
        level: profile.difficultyLevel,
        style: preferredStyle,
        generatedAt: new Date().toISOString(),
        tableOfContents: toc,
        chapters: generatedChapters,
        totalChapters: generatedChapters.length
      }
    });
  } catch (err) {
    console.error("❌ Textbook generation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ╔═══════════════════════════════════════════════════════════════╗
// ║  2. VOICE EMOTION MIRROR — AI hears your confusion           ║
// ╚═══════════════════════════════════════════════════════════════╝

router.post("/voice-emotion/ask", async (req, res) => {
  try {
    const { question, userId, subject, voiceMetrics } = req.body;
    if (!question) return res.status(400).json({ error: "Question required" });

    // Analyze voice metrics to determine emotional state
    const emotion = analyzeVoiceEmotion(voiceMetrics || {});

    // Get user profile for adaptive response
    let profile = await LearningProfile.findOne({ userId });
    if (!profile) profile = await LearningProfile.create({ userId });

    // Build emotion-adaptive prompt
    const emotionPrompts = {
      confident: "The student sounds confident and clear. Give a concise, direct answer. They know what they're asking.",
      confused: "The student's VOICE reveals deep confusion — hesitation, slow speech, uncertain tone. Start from absolute basics. Use extremely simple language. Break everything into tiny steps. Be very patient and encouraging.",
      frustrated: "The student's voice shows FRUSTRATION — fast speech, high energy, agitation. Acknowledge their frustration first ('I understand this is tricky'). Then give the simplest possible explanation. Use bullet points. Be warm.",
      anxious: "The student sounds ANXIOUS — low energy, trembling speech, many pauses. Be extremely gentle and reassuring. Use phrases like 'Don't worry, this is a common question.' Build their confidence.",
      curious: "The student sounds EXCITED and curious — energetic, fast-paced. Match their energy! Give a thorough, enthusiastic answer with interesting facts and deep dives."
    };

    const systemPrompt = `You are TechTwin AI — an emotionally intelligent tutor for ${subject || "learning"}.

STUDENT EMOTION DETECTED FROM VOICE: ${emotion.state} (confidence: ${emotion.confidence}%)
${emotionPrompts[emotion.state] || emotionPrompts.confused}

Student Level: ${profile.difficultyLevel || "beginner"}

Adapt your ENTIRE response style to match the student's emotional state. This is critical.`;

    const answer = await aiComplete(systemPrompt, question, 800);

    // Save emotion data to profile
    if (profile) {
      profile.frustrationLevel = emotion.state === "frustrated" ? "frustrated" :
                                  emotion.state === "confused" ? "confused" :
                                  emotion.state === "anxious" ? "confused" :
                                  emotion.state === "curious" ? "curious" : "neutral";
      await profile.save();
    }

    res.json({
      success: true,
      answer,
      emotion: {
        state: emotion.state,
        confidence: emotion.confidence,
        icon: emotion.icon,
        color: emotion.color,
        advice: emotion.advice
      }
    });
  } catch (err) {
    console.error("❌ Voice emotion error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Voice emotion analysis engine
function analyzeVoiceEmotion(metrics) {
  const {
    avgPitch = 150,
    pitchVariance = 30,
    speakingRate = 3,    // words per second
    pauseRatio = 0.2,   // fraction of silence
    energy = 0.5,        // 0-1 RMS energy
    backtrackCount = 0   // times user restarted sentence
  } = metrics;

  let state = "confident";
  let confidence = 60;
  let icon = "😊";
  let color = "#22c55e";
  let advice = "";

  // High pause ratio + low energy + slow rate = confusion
  if (pauseRatio > 0.35 && speakingRate < 2.5 && energy < 0.4) {
    state = "confused";
    confidence = Math.min(90, 60 + (pauseRatio * 50));
    icon = "😕";
    color = "#eab308";
    advice = "I detected hesitation in your voice. Let me explain this more simply.";
  }
  // High energy + fast rate + high pitch variance = frustration
  else if (energy > 0.7 && speakingRate > 4 && pitchVariance > 50) {
    state = "frustrated";
    confidence = Math.min(95, 60 + (energy * 30));
    icon = "😤";
    color = "#ef4444";
    advice = "I can hear this topic is challenging. Let me take a different approach.";
  }
  // Low energy + high pause + backtracks = anxiety
  else if (energy < 0.3 && pauseRatio > 0.3 && backtrackCount > 2) {
    state = "anxious";
    confidence = Math.min(85, 55 + (backtrackCount * 10));
    icon = "😰";
    color = "#f97316";
    advice = "Don't worry — this is a perfectly valid question. Let me help.";
  }
  // High energy + moderate rate + low pauses = curious/excited
  else if (energy > 0.5 && speakingRate > 3 && pauseRatio < 0.15) {
    state = "curious";
    confidence = Math.min(85, 60 + (energy * 25));
    icon = "🤩";
    color = "#8B5CF6";
    advice = "Great enthusiasm! Let me give you a thorough deep-dive.";
  }
  // Default: confident
  else {
    state = "confident";
    confidence = 65;
    icon = "😊";
    color = "#22c55e";
    advice = "Clear question — here's a direct answer.";
  }

  return { state, confidence, icon, color, advice };
}


// ╔═══════════════════════════════════════════════════════════════╗
// ║  3. TEACHER STYLE CLONING — "Explain like Prof. X"           ║
// ╚═══════════════════════════════════════════════════════════════╝

// Get all teachers and their teaching styles
router.get("/teacher-style/teachers", async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher", status: "approved" })
      .select("name email subjects department");

    // For each teacher, analyze their style from past replies
    const teacherProfiles = [];

    for (const teacher of teachers) {
      const replies = await Query.find({
        teacherReply: { $exists: true, $ne: "" }
      }).limit(20);

      // Analyze style characteristics
      let style = {
        avgLength: 0,
        usesCode: false,
        usesAnalogies: false,
        formalityLevel: "moderate",
        exampleCount: 0,
        samplePhrases: []
      };

      if (replies.length > 0) {
        const lengths = replies.map(r => r.teacherReply.length);
        style.avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);

        const allText = replies.map(r => r.teacherReply).join(" ").toLowerCase();
        style.usesCode = allText.includes("```") || allText.includes("function") || allText.includes("code");
        style.usesAnalogies = allText.includes("like") || allText.includes("imagine") || allText.includes("think of");
        style.formalityLevel = allText.includes("furthermore") || allText.includes("therefore") ? "formal" :
          allText.includes("basically") || allText.includes("so") ? "casual" : "moderate";

        // Extract sample phrases
        style.samplePhrases = replies.slice(0, 3).map(r => r.teacherReply.substring(0, 100) + "...");
      }

      teacherProfiles.push({
        id: teacher._id,
        name: teacher.name,
        subjects: teacher.subjects,
        department: teacher.department,
        replyCount: replies.length,
        style
      });
    }

    res.json({ success: true, teachers: teacherProfiles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ask a question in a specific teacher's style
router.post("/teacher-style/ask", async (req, res) => {
  try {
    const { question, teacherId, subject, userId } = req.body;
    if (!question) return res.status(400).json({ error: "Question required" });

    // Get teacher info
    const teacher = await User.findById(teacherId).select("name subjects");
    if (!teacher) return res.status(404).json({ error: "Teacher not found" });

    // Get teacher's past replies to learn their style
    const teacherReplies = await Query.find({
      teacherReply: { $exists: true, $ne: "" }
    }).limit(15).select("queryText teacherReply subject");

    // Build style analysis prompt
    let styleContext = "";
    if (teacherReplies.length > 0) {
      const samples = teacherReplies.slice(0, 5).map(r =>
        `Student asked: "${r.queryText}"\nTeacher replied: "${r.teacherReply}"`
      ).join("\n\n");

      styleContext = `Here are examples of how ${teacher.name} explains things:
${samples}

Analyze their style:
- Their preferred vocabulary and sentence structure
- Whether they use code examples, analogies, or formal definitions
- Their tone (encouraging, strict, casual, academic)
- How they structure explanations (top-down, bottom-up, example-first)

Now MIMIC this exact style to answer the new question.`;
    } else {
      styleContext = `${teacher.name} is a teacher in ${teacher.subjects?.join(", ")}. 
Since we don't have sample replies yet, use a warm, professional teaching style.`;
    }

    const systemPrompt = `You are an AI that perfectly clones a specific teacher's explanation style.

TEACHER: ${teacher.name}
SUBJECTS: ${teacher.subjects?.join(", ")}

${styleContext}

IMPORTANT: Your answer should sound EXACTLY like ${teacher.name} would explain it — their word choices, their level of detail, their personality. The student should feel like they're reading ${teacher.name}'s actual response.`;

    const answer = await aiComplete(systemPrompt, question, 800);

    res.json({
      success: true,
      answer,
      teacherName: teacher.name,
      teacherSubjects: teacher.subjects,
      cloneConfidence: teacherReplies.length > 5 ? "high" : teacherReplies.length > 0 ? "medium" : "developing",
      samplesUsed: Math.min(teacherReplies.length, 5)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ╔═══════════════════════════════════════════════════════════════╗
// ║  4. EXAM REVERSE-ENGINEERING — Crack the professor's code    ║
// ╚═══════════════════════════════════════════════════════════════╝

// Analyze past exam papers
router.post("/exam-reverse/analyze", async (req, res) => {
  try {
    const { examTexts, subject, userId } = req.body;
    if (!examTexts || !examTexts.length) return res.status(400).json({ error: "Exam text(s) required" });

    const allExamText = examTexts.join("\n\n--- NEXT EXAM PAPER ---\n\n");

    const analysisPrompt = `You are an exam pattern forensic analyst. Analyze these past exam papers and extract PRECISE patterns.

SUBJECT: ${subject}

EXAM PAPERS:
${allExamText}

Return a JSON object with EXACTLY this structure:
{
  "topicFrequency": [{"topic": "topic name", "frequency": 85, "avgMarks": 15}],
  "questionStyles": [{"style": "conceptual|numerical|code|diagram|short-answer|essay", "percentage": 40}],
  "trapPatterns": [{"description": "Common trap description", "example": "Example of how it appears", "howToAvoid": "Strategy"}],
  "difficultyDistribution": {"easy": 30, "medium": 50, "hard": 20},
  "mustStudyTopics": ["topic1", "topic2", "topic3"],
  "surpriseTopics": ["unusual topic that appeared"],
  "timeStrategy": {"section1": "X minutes", "section2": "Y minutes"},
  "professorTendencies": ["tendency 1", "tendency 2"]
}`;

    const raw = await aiComplete(analysisPrompt, `Analyze these ${examTexts.length} exam papers for ${subject}`, 1500);
    const analysis = extractJSON(raw, {
      topicFrequency: [],
      questionStyles: [],
      trapPatterns: [],
      difficultyDistribution: { easy: 33, medium: 34, hard: 33 },
      mustStudyTopics: [],
      surpriseTopics: [],
      timeStrategy: {},
      professorTendencies: []
    });

    res.json({
      success: true,
      analysis,
      papersAnalyzed: examTexts.length,
      subject
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate predicted mock exam
router.post("/exam-reverse/mock", async (req, res) => {
  try {
    const { subject, analysis, userId, totalMarks = 100 } = req.body;
    if (!subject) return res.status(400).json({ error: "Subject required" });

    const analysisContext = analysis ? JSON.stringify(analysis) : "No prior analysis available";

    const mockPrompt = `You are generating a PREDICTED exam paper that mimics a specific professor's style.

SUBJECT: ${subject}
TOTAL MARKS: ${totalMarks}

PROFESSOR'S PATTERNS (from past paper analysis):
${analysisContext}

Generate a COMPLETE mock exam paper that:
1. Follows the professor's topic distribution
2. Uses their favorite question styles
3. Includes their typical trap patterns
4. Matches their difficulty distribution
5. Feels like it was written by the SAME professor

Return JSON:
{
  "title": "Mock Exam: ${subject}",
  "totalMarks": ${totalMarks},
  "duration": "3 hours",
  "sections": [
    {
      "name": "Section A",
      "instructions": "...",
      "marks": 40,
      "questions": [
        {"number": 1, "question": "...", "marks": 10, "type": "conceptual", "topic": "...", "difficulty": "medium", "hint": "This is a typical trap question — watch for...", "modelAnswer": "..."}
      ]
    }
  ],
  "studyTips": ["tip 1", "tip 2"]
}`;

    const raw = await aiComplete(mockPrompt, `Generate predicted ${subject} exam (${totalMarks} marks)`, 2000);
    const mockExam = extractJSON(raw, { title: `Mock Exam: ${subject}`, sections: [], studyTips: [] });

    res.json({ success: true, mockExam });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ╔═══════════════════════════════════════════════════════════════╗
// ║  5. LIVE LECTURE CO-PILOT — AI sits in class with you        ║
// ╚═══════════════════════════════════════════════════════════════╝

// "I'm Lost" - instant micro-explanation during live lecture
router.post("/lecture/im-lost", async (req, res) => {
  try {
    const { transcript, lastSentences, userId, subject } = req.body;
    if (!lastSentences) return res.status(400).json({ error: "Transcript data required" });

    // Get student profile to know their level
    let profile = await LearningProfile.findOne({ userId });
    if (!profile) profile = await LearningProfile.create({ userId });

    const systemPrompt = `You are a real-time lecture co-pilot. A student just pressed "I'm Lost" during a live lecture.

STUDENT LEVEL: ${profile?.difficultyLevel || "beginner"}
SUBJECT: ${subject || "unknown"}

The student heard this from the professor (last 30 seconds):
"${lastSentences}"

${transcript ? `Full lecture transcript so far:\n"${transcript.slice(-2000)}"` : ""}

Your job:
1. IDENTIFY which specific sentence/concept likely confused them
2. Give a MICRO-EXPLANATION (3-4 sentences MAX) — they're still in a live lecture, no time for long answers
3. Use EXTREMELY simple language
4. If there's a key term, define it in one sentence

Return JSON:
{
  "confusingPart": "The specific sentence that likely confused them",
  "microExplanation": "3-4 sentence simple explanation",
  "keyTerm": "The main term to understand",
  "keyTermDefinition": "One-line definition",
  "emoji": "relevant emoji"
}`;

    const raw = await aiComplete(systemPrompt, `Student pressed I'M LOST. Last heard: "${lastSentences}"`, 400);
    const result = extractJSON(raw, {
      confusingPart: lastSentences,
      microExplanation: "Let me break this down simply...",
      keyTerm: "",
      keyTermDefinition: "",
      emoji: "💡"
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Post-lecture summary + flashcards
router.post("/lecture/summary", async (req, res) => {
  try {
    const { fullTranscript, userId, subject, lostMoments = [] } = req.body;
    if (!fullTranscript) return res.status(400).json({ error: "Transcript required" });

    let profile = await LearningProfile.findOne({ userId });
    if (!profile) profile = await LearningProfile.create({ userId });

    const lostContext = lostMoments.length > 0
      ? `\nThe student pressed "I'm Lost" at these moments:\n${lostMoments.map(m => `- "${m}"`).join("\n")}`
      : "";

    const summaryPrompt = `You are a lecture summary AI for a ${profile?.difficultyLevel || "beginner"} level student.

SUBJECT: ${subject}
FULL LECTURE TRANSCRIPT:
"${fullTranscript.slice(0, 4000)}"
${lostContext}

Generate a PERSONALIZED lecture summary. Focus MORE on parts the student found confusing.

Return JSON:
{
  "title": "Lecture summary title",
  "summary": "4-6 paragraph structured summary in Markdown",
  "keyTopics": ["topic1", "topic2"],
  "flashcards": [
    {"front": "Question/term", "back": "Answer/definition"}
  ],
  "confusionPoints": ["point where student was lost"],
  "followUpQuestions": ["question to ask professor next class"],
  "actionItems": ["Review X", "Practice Y"]
}`;

    const raw = await aiComplete(summaryPrompt, "Generate personalized lecture summary", 1500);
    const result = extractJSON(raw, {
      title: `${subject} Lecture Summary`,
      summary: "Summary processing...",
      keyTopics: [],
      flashcards: [],
      confusionPoints: lostMoments,
      followUpQuestions: [],
      actionItems: []
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ╔═══════════════════════════════════════════════════════════════╗
// ║  6. SILENT MISUNDERSTANDING SCANNER (SURPRISE!)              ║
// ║  "You got it right... but do you REALLY understand it?"      ║
// ╚═══════════════════════════════════════════════════════════════╝

// Generate a probe question after a correct quiz answer
router.post("/probe/generate", async (req, res) => {
  try {
    const { question, correctAnswer, topic, subject, userId } = req.body;
    if (!question || !correctAnswer) return res.status(400).json({ error: "Question and answer required" });

    const probePrompt = `You are a misconception detection engine. A student just answered a quiz question CORRECTLY. Your job is to test if they TRULY understood it, or just memorized/guessed.

ORIGINAL QUESTION: "${question}"
CORRECT ANSWER THE STUDENT GAVE: "${correctAnswer}"
TOPIC: ${topic || "general"}
SUBJECT: ${subject || "general"}

Generate ONE probe question that:
1. Tests the UNDERLYING PRINCIPLE, not the surface answer
2. Would be EASY if they truly understand, but IMPOSSIBLE if they just memorized
3. Changes one variable/condition from the original question to test real understanding
4. Is tricky enough to catch pattern-matching but fair for genuine understanding

Return JSON:
{
  "probeQuestion": "The probe question text",
  "expectedAnswer": "What someone who truly understands would answer",
  "misconceptionItTests": "What wrong belief this exposes if they fail",
  "difficulty": "medium",
  "probeType": "variable-change|edge-case|inverse|why-question|transfer"
}`;

    const raw = await aiComplete(probePrompt, `Generate probe for: "${question}"`, 400);
    const probe = extractJSON(raw, {
      probeQuestion: `Why does this work? Explain the underlying principle of: ${question}`,
      expectedAnswer: "Explanation of the core principle",
      misconceptionItTests: "Surface-level memorization without understanding",
      difficulty: "medium",
      probeType: "why-question"
    });

    res.json({ success: true, probe });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Evaluate student's response to probe question
router.post("/probe/evaluate", async (req, res) => {
  try {
    const { probeQuestion, studentAnswer, expectedAnswer, topic, subject, userId } = req.body;
    if (!probeQuestion || !studentAnswer) return res.status(400).json({ error: "Probe question and student answer required" });

    const evalPrompt = `You are evaluating if a student TRULY understands a concept or is just memorizing.

PROBE QUESTION: "${probeQuestion}"
EXPECTED ANSWER: "${expectedAnswer}"
STUDENT'S ANSWER: "${studentAnswer}"
TOPIC: ${topic}

Evaluate:
1. Does the student demonstrate GENUINE understanding or surface-level memorization?
2. Are there any MISCONCEPTIONS revealed by their answer?
3. What's their Understanding Authenticity Score (0-100)?

Return JSON:
{
  "isAuthentic": true/false,
  "authenticityScore": 0-100,
  "verdict": "GENUINE UNDERSTANDING" or "SURFACE MEMORIZATION" or "PARTIAL UNDERSTANDING",
  "feedback": "Detailed, kind feedback explaining what they understand and what they don't",
  "misconceptions": ["misconception 1 if any"],
  "recommendation": "What they should do next to build real understanding"
}`;

    const raw = await aiComplete(evalPrompt, `Evaluate: "${studentAnswer}"`, 500);
    const evaluation = extractJSON(raw, {
      isAuthentic: false,
      authenticityScore: 50,
      verdict: "PARTIAL UNDERSTANDING",
      feedback: "Let's review the core concept more carefully.",
      misconceptions: [],
      recommendation: "Review the fundamentals of this topic."
    });

    // Update profile with authenticity data
    if (userId) {
      try {
        const profile = await LearningProfile.findOne({ userId });
        if (profile) {
          if (!profile.authenticityScores) profile.authenticityScores = new Map();
          const currentScore = profile.authenticityScores.get(topic) || 50;
          const newScore = Math.round((currentScore + evaluation.authenticityScore) / 2);
          profile.authenticityScores.set(topic, newScore);
          await profile.save();
        }
      } catch (e) { /* ignore profile update errors */ }
    }

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


export default router;
