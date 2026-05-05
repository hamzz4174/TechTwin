import OpenAI from "openai";
import express from "express";
import multer from "multer";
import fs from "fs";
import pdf from "pdf-parse";
import { MongoClient } from "mongodb";
import path from "path";
import { pipeline } from "@xenova/transformers";
import Notification from "./notification.js"


// ===== CONFIG =====
const MONGO_URI = "mongodb://ogxarise:one%40piece@ac-t56ytuv-shard-00-00.m7y1itn.mongodb.net:27017,ac-t56ytuv-shard-00-01.m7y1itn.mongodb.net:27017,ac-t56ytuv-shard-00-02.m7y1itn.mongodb.net:27017/?ssl=true&replicaSet=atlas-qja4z7-shard-0&authSource=admin&appName=ai-teacher-assistant";
const DB_NAME = "techtwin";
const COLLECTION = "contentchunks";
const CHUNK_SIZE = 500;  // words per chunk
const OVERLAP = 100;
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // make sure your .env has OPENAI_API_KEY
}); // overlap between chunks

// ===== INIT =====
const client = new MongoClient(MONGO_URI);
let embedder;

// ===== PRELOAD EMBEDDER =====
(async () => {
  console.log("🚀 Loading Xenova embedding model...");
  embedder = await pipeline("feature-extraction", "sentence-transformers/all-MiniLM-L6-v2", { quantized: false });
  console.log("✅ Embedder loaded");

  // Connect MongoDB once
  try {
    await client.connect();
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
})();

// ===== EXPRESS SETUP =====
const router = express.Router();
const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },

  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, safeName);
  }
})

const upload = multer({ storage })
// ===== HELPER: split text into overlapping chunks =====
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = OVERLAP) {
  const tokens = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < tokens.length; i += chunkSize - overlap) {
    const chunk = tokens.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk);
  }
  return chunks;
}

// ===== GET all uploaded lectures =====
router.get("/", async (req, res) => {
  try {
    const chunks = await client.db(DB_NAME).collection(COLLECTION).find().toArray();
    res.json({ count: chunks.length, chunks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST upload lecture PDF with subject =====
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const subject = req.body.subject;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const savedName = req.file.filename;
    const destPath = req.file.path;

    const dataBuffer = fs.readFileSync(destPath);
    const pdfData = await pdf(dataBuffer);
    const fullText = pdfData?.text || "";

    const chunks = chunkText(fullText);

    console.log(`[+] Creating embeddings for ${chunks.length} chunks...`);

    const chunkObjects = await Promise.all(
      chunks.map(async (chunkText, i) => {
        const output = await embedder(chunkText, { pooling: "mean", normalize: true });
        console.log(`[+] Embedded chunk ${i + 1}/${chunks.length}`);
        return {
          chunkText,
          embedding: Array.from(output.data),
          pdf_name: savedName,
          subject,
          title: req.body.title || "",
          description: req.body.description || "",
          uploadedBy: req.body.uploadedBy || "",
        };
      })
    );

    const col = client.db(DB_NAME).collection(COLLECTION);
    await col.insertMany(chunkObjects);

    // 🔔 CREATE NOTIFICATION
    await Notification.create({
      message: `New Lecture Uploaded: ${req.body.title}`,
      type: "pdf",
      subject: subject,
      time: new Date()
    });

    res.status(201).json({
      message: "PDF uploaded + chunks stored with subject and Xenova embeddings",
      chunkCount: chunks.length,
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { query, subject } = req.body;
    if (!query || !subject) return res.status(400).json({ error: "Query and subject required" });

    if (!embedder) return res.status(500).json({ error: "Embedder not ready" });

    // Embed query
    const queryEmbedding = Array.from(
      (await embedder(query, { pooling: "mean", normalize: true })).data
    );

    await client.connect();
    const col = client.db(DB_NAME).collection(COLLECTION);
    const chunks = await col.find({ subject }).toArray();
    await client.close();

    if (!chunks.length) return res.json({ answer: `No PDFs found for ${subject}` });

    // Rank chunks by similarity
    function cosineSim(a, b) {
      const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
      const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
      return dot / (normA * normB);
    }

    const topChunks = chunks
      .map(c => ({ ...c, similarity: cosineSim(queryEmbedding, c.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5); // top 5 chunks

    // Combine text for GPT
    const combinedText = topChunks.map(c => c.chunkText).join("\n\n");

    // Call OpenAI to summarize in bullet points
    const prompt = `
      Summarize the following text to answer the question: "${query}"
      Make it concise and structured with bullet points. Avoid repeating the same info.
      Text:
      ${combinedText}
    `;

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });

    const answer = gptResponse.choices[0].message.content;

    res.json({ answer, sources: topChunks });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== GET all subjects =====
router.get("/subjects", async (req, res) => {
  try {
    const subjects = await client.db(DB_NAME).collection(COLLECTION).distinct("subject");
    res.json({ subjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
