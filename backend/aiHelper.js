/**
 * TechTwin AI Helper — Smart Fallback Engine
 * Priority: OpenAI → Gemini Flash → Ollama (local)
 * Automatically switches when quota/rate-limit is hit.
 */
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const openaiKey = process.env.OPENAI_API_KEY;
const openai = openaiKey && !openaiKey.includes("YOUR_OPENAI") ? new OpenAI({ apiKey: openaiKey }) : null;

const genAI = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("YOUR_GEMINI")
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const OLLAMA_URL = "http://localhost:11434/api/generate";

/**
 * Universal AI completion with automatic fallback chain.
 * @param {string} systemPrompt - system instructions
 * @param {string} userMessage  - user's question
 * @param {number} maxTokens    - max output tokens
 * @returns {Promise<string>}   - AI reply text
 */
export async function aiComplete(systemPrompt, userMessage, maxTokens = 500) {
  // ── 1. Try Gemini Flash (Fastest + Free) ───────────────
  if (genAI) {
    try {
      let model;
      try {
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      } catch {
        // Fallback for older library versions or specific region restrictions
        model = genAI.getGenerativeModel({ model: "gemini-pro" });
      }
      const result = await model.generateContent(`${systemPrompt}\n\nUser: ${userMessage}`);
      console.info("✅ Gemini answered.");
      return result.response.text();
    } catch (geminiErr) {
      console.warn("⚠️ Gemini failed, trying fallbacks...", geminiErr.message);
    }
  }

  // ── 2. Try OpenAI ──────────────────────────────────────
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: maxTokens
      });
      console.info("✅ OpenAI answered.");
      return completion.choices[0].message.content;
    } catch (openaiErr) {
      console.warn("⚠️ OpenAI failed, trying Ollama...", openaiErr.message);
    }
  }

  // ── 3. Try Ollama local (Fallback for offline/quota) ────
  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        prompt: `${systemPrompt}\n\nQuestion: ${userMessage}\n\nAnswer:`,
        stream: false,
        options: { num_predict: maxTokens }
      })
    });
    const data = await response.json();
    if (data.response !== undefined) {
      console.info("✅ Ollama answered.");
      return data.response;
    }
    throw new Error(data.error || "Ollama returned empty response");
  } catch (ollamaErr) {
    console.error("❌ All AI providers failed:", ollamaErr.message);
  }

  return "I'm currently experiencing high demand. Please ensure your Gemini API key is active in the .env file.";
}

/**
 * Quick JSON extraction helper — tries to parse JSON from any AI response.
 * @param {string} text - raw AI response
 * @param {*} fallback  - value to return if parsing fails
 */
export function extractJSON(text, fallback = null) {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try to extract JSON array
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch { } }
    // Try to extract JSON object
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) { try { return JSON.parse(objMatch[0]); } catch { } }
    return fallback;
  }
}
