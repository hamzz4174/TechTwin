import { callGeminiEmbedding } from "./geminiEmbed.js";

(async () => {
  const embedding = await callGeminiEmbedding("Hello world");
  console.log("Embedding length:", embedding.length);
})();