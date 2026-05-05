import express from "express";
import { MongoClient } from "mongodb";
import { pipeline } from "@xenova/transformers";
import fetch from "node-fetch"; // For local Ollama API
import { aiComplete } from "./aiHelper.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const router = express.Router();

// ===== CONFIG =====
const MONGO_URI = "mongodb://ogxarise:one%40piece@ac-t56ytuv-shard-00-00.m7y1itn.mongodb.net:27017,ac-t56ytuv-shard-00-01.m7y1itn.mongodb.net:27017,ac-t56ytuv-shard-00-02.m7y1itn.mongodb.net:27017/?ssl=true&replicaSet=atlas-qja4z7-shard-0&authSource=admin&appName=ai-teacher-assistant";
const DB_NAME = "techtwin";
const COLLECTION = "contentchunks";

// ===== INIT =====
const client = new MongoClient(MONGO_URI);
let db, embedder;

// Pre-load Xenova embedder and MongoDB
(async () => {
  try {
    console.log("🚀 Pre-loading Xenova embedder (ask.js)...");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Embedder ready (ask.js)");
    
    await client.connect();
    db = client.db(DB_NAME);
    console.log("✅ MongoDB connected (ask.js)");
  } catch (err) {
    console.error("❌ Startup failed (ask.js):", err);
  }
})();

// ===== Helper: Cosine similarity =====
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (normA * normB);
}

// ===== ROUTES =====

// ✅ Get all subjects
router.get("/subjects", async (req, res) => {
  try {

    if (!db) {
      return res.status(500).json({
        error: "Database not connected yet"
      })
    }

    const col = db.collection(COLLECTION)

    const subjects = await col.distinct("subject")

    res.json({
      success: true,
      subjects: subjects
    })

  } catch (err) {

    console.error("Subjects fetch error:", err)

    res.status(500).json({
      success: false,
      error: err.message
    })

  }
})

// ✅ Get PDFs by subject
router.get("/pdfs/:subject", async (req, res) => {
  try {
    const { subject } = req.params;
    const col = db.collection(COLLECTION);
    const pdfs = await col.distinct("pdf_name", { subject });
    res.json({ pdfs });
  } catch (err) {
    console.error("PDF fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Serve or download PDF
router.get("/download/:subject/:pdf", (req, res) => {
  try {
    const { pdf } = req.params;
    const uploadsDir = path.join(__dirname, "uploads");

    // Try multiple filename variants to find the actual file on disk
    const candidates = [
      pdf,                                      // as-is from DB
      pdf.replace(/\s+/g, "_"),                 // spaces → underscores
      pdf.replace(/[^a-zA-Z0-9._-]/g, "_"),    // all special chars → underscores
    ];

    let filePath = null;
    for (const candidate of candidates) {
      const fp = path.join(uploadsDir, candidate);
      if (fs.existsSync(fp)) {
        filePath = fp;
        break;
      }
    }

    if (filePath) {
      res.setHeader("Content-Type", "application/pdf");
      res.sendFile(filePath);
    } else {
      console.warn(`[download] File not found for: ${pdf}. Tried:`, candidates);
      res.status(404).json({ error: "File not found", tried: candidates });
    }
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Main question → answer route
router.post("/", async (req, res) => {
  try {
    const { question, subject, pdf, userId } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    if (!embedder) return res.status(503).json({ error: "AI Engine is still loading. Try again in 5 seconds." });

    // Embed user question
    const qEmbeddingOutput = await embedder(question, { pooling: "mean", normalize: true });
    const qEmbedding = Array.from(qEmbeddingOutput.data);

    // Fetch chunks only for that subject/pdf
    const col = db.collection(COLLECTION);
    const query = {};
    if (subject) query.subject = subject;
    if (pdf) query.pdf_name = pdf;

    const chunks = await col.find(query).toArray();
    console.log(`[Ask] Found ${chunks.length} chunks for subject: ${subject || 'all'}, pdf: ${pdf || 'all'}`);
    if (!chunks.length) return res.json({ answer: "No content found for this subject or PDF.", sources: [] });

    // Rank chunks by similarity
    const scored = chunks.map((chunk) => ({
      ...chunk,
      similarity: cosineSimilarity(qEmbedding, chunk.embedding),
    }));
    scored.sort((a, b) => b.similarity - a.similarity);

    const topChunks = scored.slice(0, 3);
    const contextText = topChunks.map((c) => c.chunkText).join("\n\n");

    // ===== Universal AI Completion (Gemini -> OpenAI -> Ollama) =====
    const systemPrompt = `You are a helpful assistant that answers ONLY using the provided PDF context. 
Context:
${contextText}`;

    const answer = await aiComplete(systemPrompt, question, 600);

    res.json({ answer, sources: topChunks });
  } catch (err) {
    console.error("Ask error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
