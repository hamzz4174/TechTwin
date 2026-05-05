// testToken.js
import { getAccessToken } from "./geminiAuth.js";

(async () => {
  try {
    const token = await getAccessToken();
    console.log("Gemini access token:", token);
  } catch (err) {
    console.error("Failed to get token:", err);
  }
})();
