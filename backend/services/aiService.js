import axios from "axios";

/**
 * Generates an AI response using Google Gemini 1.5 Flash API
 * @param {string} incomingText - The message from the customer
 * @param {object} contact - The Contact Mongoose document
 * @returns {Promise<string|null>} The AI response, or null if key is missing or error occurs
 */
export async function generateAIResponse(incomingText, contact) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("⚠️ GEMINI_API_KEY is not defined in the environment. Skipping AI response.");
    return null;
  }

  try {
    // Define a system prompt to keep the bot polite, helpful, and matching the user's language
    const systemPrompt = `You are an intelligent, helpful WhatsApp customer service assistant for our business.
The customer's name is "${contact?.name || "Customer"}".
Keep your responses short, helpful, polite, and under 2-3 sentences.
Always reply in the same language or style as the customer (use Hinglish, Hindi, or English as appropriate).`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nCustomer: ${incomingText}\nAssistant:`
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.7
        }
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) {
      return replyText.trim();
    }
    return null;
  } catch (error) {
    console.error("❌ Gemini AI Service error:", error?.response?.data || error.message);
    return null;
  }
}
