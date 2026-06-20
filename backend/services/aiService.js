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

/**
 * Uses Gemini to semantically match a user's reply to one of the flow options.
 */
export async function matchOptionWithAI(incomingText, options) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !options || options.length === 0) return null;

  try {
    const optionsList = options.map((opt, idx) => `ID: ${idx}, Keywords: ${opt.keywords || ""}, Text: ${opt.replyText || opt.label || ""}`).join("\n");
    const systemPrompt = `You are an AI classifier. A WhatsApp user was presented with a list of options and they replied.
Your task is to determine which option they selected, based on their message and the keywords/descriptions of the options.
Here are the options:
${optionsList}

Analyze the user's input: "${incomingText}".
Does it match any option? If yes, respond with ONLY the integer ID of the matched option (e.g., 0 or 1).
If it doesn't match any option, respond with the word "NONE".
Do not include any other text, explanation, or punctuation.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.1
        }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log(`🤖 AI Option Match Result: "${result}" for input: "${incomingText}"`);
    if (result && result !== "NONE") {
      const idx = parseInt(result, 10);
      if (!isNaN(idx) && idx >= 0 && idx < options.length) {
        return options[idx];
      }
    }
    return null;
  } catch (error) {
    console.error("❌ Gemini AI Option Match error:", error.message);
    return null;
  }
}

/**
 * Generates a contextual reply using Gemini when a user asks something unrelated during a flow.
 */
export async function generateAIResponseForFlow(incomingText, nextQuestion, contact) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const systemPrompt = `You are an intelligent, helpful WhatsApp customer service assistant.
The customer is currently in a step-by-step chat flow and we just asked them a question/options: "${nextQuestion}".
Instead of choosing an option or answering the question, they said: "${incomingText}".
Understand their message and give a very short, polite answer (1-2 sentences max) in a conversational tone. Do not try to answer the flow question yourself, just address their query/message politely.
Reply in the same language style they used (e.g., Hinglish, Hindi, or English).`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.7
        }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return replyText ? replyText.trim() : null;
  } catch (error) {
    console.error("❌ Gemini AI Flow Response error:", error.message);
    return null;
  }
}

/**
 * Validates flow text inputs using Gemini to filter out questions, queries, or objections.
 */
export async function validateFlowInput(incomingText, fieldName, questionText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { isQueryOrQuestion: false };

  try {
    const systemPrompt = `You are an AI assistant validating inputs for a WhatsApp database.
We asked the user the following question: "${questionText}" to collect the field: "${fieldName}".
The user replied: "${incomingText}".

Evaluate if the user's response is a genuine attempt to provide the requested information (like a name, company, email, location details, etc.) OR if it is a question, query, objection, or unrelated query (e.g., "kitna paisa lagega?", "who are you?", "what is this?", "no thanks").

Respond in JSON format:
{
  "isQueryOrQuestion": true/false, // true if it is a question, query, objection, or unrelated query rather than the requested info.
  "politeResponse": "..." // if isQueryOrQuestion is true, provide a very short polite response answering their question or query in their language (Hinglish/Hindi/English). Otherwise null.
}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (result) {
      return JSON.parse(result.trim());
    }
    return { isQueryOrQuestion: false };
  } catch (error) {
    console.error("❌ Gemini AI validation error:", error.message);
    return { isQueryOrQuestion: false };
  }
}
