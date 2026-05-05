import mongoose from "mongoose";

// Learning Profile Schema - stores all AI Twin data per user
const learningProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

  // Adaptive Difficulty (#3)
  difficultyLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
  levelScore: { type: Number, default: 0 }, // 0-100

  // Streak System (#10)
  streak: { type: Number, default: 0 },
  lastActiveDate: { type: Date },
  longestStreak: { type: Number, default: 0 },
  totalDaysActive: { type: Number, default: 0 },

  // Weakness Radar / Heatmap (#9, #30)
  subjectScores: {
    type: Map,
    of: Number, // subject => score 0-100
    default: {}
  },
  weakTopics: [{ type: String }],
  strongTopics: [{ type: String }],

  // Memory-based AI (#5)
  recentTopics: [{ type: String }], // last 10 topics asked
  mistakePatterns: [{ type: String }], // recurring mistake types

  // Time-to-Learn Predictor (#27)
  avgSessionTime: { type: Number, default: 0 }, // minutes
  conceptsLearned: { type: Number, default: 0 },

  // Gamification
  xpPoints: { type: Number, default: 0 },
  badges: [{ type: String }],

  // Confusion Detection (#4)
  confusionCount: { type: Number, default: 0 },
  frustrationLevel: { type: String, enum: ["calm", "neutral", "curious", "confused", "frustrated"], default: "neutral" },

  // Self-Improving AI (#16)
  feedbackGiven: [{ questionId: String, helpful: Boolean, date: Date }],

  // PDF Awareness (#26)
  currentPDF: { type: String },
  currentPage: { type: Number, default: 1 },
  pdfProgress: { type: Map, of: Number, default: {} }, // pdf => page

  // Knowledge DNA (#22)
  knowledgeGraph: [{ from: String, to: String, strength: Number }],

  // World-First: Silent Misunderstanding Scanner
  authenticityScores: { type: Map, of: Number, default: {} }, // topic => 0-100 authenticity

  // World-First: Lecture Co-Pilot
  lecturesSummarized: { type: Number, default: 0 },
  lostMoments: [{ timestamp: Date, topic: String, resolved: Boolean }],

}, { timestamps: true });

export default mongoose.model("LearningProfile", learningProfileSchema);
