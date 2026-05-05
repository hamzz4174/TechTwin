import mongoose from "mongoose";

// Extended Query schema with social + clustering features
const querySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subject: { type: String, required: true },
  queryText: { type: String, required: true },

  // AI Replies
  aiReply: { type: String },
  aiReplySimple: { type: String },       // Whisper Mode
  aiReplyTechnical: { type: String },    // Technical Mode
  aiReplyExample: { type: String },      // Example Mode
  aiReplyRealLife: { type: String },     // Real-life Mode

  teacherReply: { type: String },
  status: { type: String, default: "pending" }, // pending | ai_replied | teacher_replied

  // Confusion Detection (#4)
  confusionScore: { type: Number, default: 0 }, // 0-10
  toneTag: { type: String, default: "neutral" }, // confused | frustrated | curious | neutral

  // Peer Voting (#20)
  votes: { type: Number, default: 0 },
  votedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // Doubt Clustering (#28)
  cluster: { type: String }, // e.g. "Arrays", "Sorting", "OOP"
  tags: [{ type: String }],

  // Trending (#19)
  viewCount: { type: Number, default: 0 },
  isTrending: { type: Boolean, default: false },

  // Quiz generated from this answer (#6)
  quizGenerated: { type: Boolean, default: false },

  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Query", querySchema);
