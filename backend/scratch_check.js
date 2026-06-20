import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Testing gemini-3.5-flash...");
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: 'Respond with JSON only: {"hello": "world"}' }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("RESULT:", response.data?.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
  }
}

run();
