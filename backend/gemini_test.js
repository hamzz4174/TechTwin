import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = "Hello AI Teacher, how are you?";
    const result = await model.generateContent(prompt);

    console.log("AI Reply:", result.response.text());
  } catch (error) {
    console.error("Error:", error);
  }
}
console.log("Loaded API Key:", process.env.GEMINI_API_KEY);

run();
