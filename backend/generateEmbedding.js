import fs from "fs";
import pdf from "pdf-parse";
import { MongoClient } from "mongodb";
import { pipeline } from "@xenova/transformers";

// ===== CONFIG =====
const MONGO_URI = "mongodb://ogxarise:one%40piece@ac-t56ytuv-shard-00-00.m7y1itn.mongodb.net:27017,ac-t56ytuv-shard-00-01.m7y1itn.mongodb.net:27017,ac-t56ytuv-shard-00-02.m7y1itn.mongodb.net:27017/?ssl=true&replicaSet=atlas-qja4z7-shard-0&authSource=admin&appName=ai-teacher-assistant";
const DB_NAME = "techtwin";
const COLLECTION = "contentchunks";
const PDF_PATH = "./uploads/45710273e987c5d8ed99a963058ef0ec.pdf";
const PDF_NAME = "45710273e987c5d8ed99a963058ef0ec.pdf";
const CHUNK_SIZE = 500;
const OVERLAP = 100;

// ===== INIT =====
const client = new MongoClient(MONGO_URI);
let embedder;

// ===== FUNCTIONS =====
async function extractChunks(pdfPath, chunkSize = 500, overlap = 100) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);
  const text = data.text;

  const tokens = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < tokens.length; i += chunkSize - overlap) {
    const chunk = tokens.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push({ text: chunk });
  }
  return chunks;
}

async function storePdf(pdfPath, pdfName) {
  console.log(`[+] Extracting chunks from ${pdfName}...`);
  const chunks = await extractChunks(pdfPath, CHUNK_SIZE, OVERLAP);

  console.log("[+] Loading embedding model...");
  if (!embedder) {
    embedder = await pipeline(
      "feature-extraction",
      "sentence-transformers/all-MiniLM-L6-v2",
      { quantized: false } // ✅ disable quantized ONNX
    );
  }

  console.log(`[+] Creating embeddings for ${chunks.length} chunks...`);
  for (let c of chunks) {
    const output = await embedder(c.text, { pooling: "mean", normalize: true });
    c.embedding = Array.from(output.data);
    c.pdf_name = pdfName;
  }

  console.log("[+] Inserting into MongoDB Atlas...");
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);
  await col.insertMany(chunks);

  console.log(`[✓] Stored ${chunks.length} chunks for ${pdfName}.`);
  await client.close();
}

// ===== RUN =====
storePdf(PDF_PATH, PDF_NAME).catch(console.error);
