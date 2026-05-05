// backend/contentChunk.js
import mongoose from "mongoose";

const contentChunkSchema = new mongoose.Schema({
  lectureId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecture", required: true },
  chunkText: { type: String, required: true },
  embedding: { type: [Number], default: [] }, // array of floats
  createdAt: { type: Date, default: Date.now }
});

// Optional: add a text index for fallback search
contentChunkSchema.index({ chunkText: "text" });

export default mongoose.model("ContentChunk", contentChunkSchema);
