
import express from "express";
import fetch from "node-fetch";

const router = express.Router();


router.post("/", async (req, res) => {
const API_KEY = process.env.ELEVENLABS_KEY;
try {
const { text, voiceId } = req.body;
const response = await fetch(
`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
{
method: "POST",
headers: {
"xi-api-key": API_KEY,
"Content-Type": "application/json",
"Accept": "audio/mpeg"
},
body: JSON.stringify({
text: text,
model_id: "eleven_multilingual_v2",
voice_settings: {
stability: 0.5,
similarity_boost: 0.75
}
})
}
);
if (!response.ok) {
const err = await response.text();
console.log("ElevenLabs error:", err);
return res.status(500).json({ error: "Voice generation failed" });
}
res.setHeader("Content-Type", "audio/mpeg");
res.setHeader("Transfer-Encoding", "chunked");
response.body.pipe(res);
} catch (err) {
console.error("Voice error:", err);
res.status(500).json({ error: "Voice generation failed" });
}
});

router.get("/", async (req, res) => {
const API_KEY = process.env.ELEVENLABS_KEY;
try {
const { text, voiceId } = req.query;
if (!text || !voiceId) return res.status(400).json({ error: "Missing text or voiceId" });
const response = await fetch(
`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
{
method: "POST",
headers: {
"xi-api-key": API_KEY,
"Content-Type": "application/json",
"Accept": "audio/mpeg"
},
body: JSON.stringify({
text: text,
model_id: "eleven_multilingual_v2",
voice_settings: {
stability: 0.5,
similarity_boost: 0.75
}
})
}
);
if (!response.ok) {
const err = await response.text();
console.log("ElevenLabs error:", err);
return res.status(500).json({ error: "Voice generation failed" });
}
res.setHeader("Content-Type", "audio/mpeg");
res.setHeader("Transfer-Encoding", "chunked");
response.body.pipe(res);
} catch (err) {
console.error("Voice error:", err);
res.status(500).json({ error: "Voice generation failed" });
}
});
export default router;