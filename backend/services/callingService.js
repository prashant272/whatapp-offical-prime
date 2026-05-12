import axios from "axios";

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const getHeaders = (accessToken) => ({
  Authorization: `Bearer ${accessToken?.trim()}`,
  "Content-Type": "application/json",
});

/**
 * Initiates a WhatsApp Voice or Video call via Cloud API
 * @param {Object} account - The WhatsApp Account object
 * @param {string} to - Recipient phone number
 * @param {string} type - "audio" or "video"
 */
export const initiateWhatsAppCall = async (account, to, type = "audio") => {
  let cleanTo = to.toString().replace(/\D/g, "");
  if (cleanTo.length === 10) cleanTo = "91" + cleanTo;

  try {
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/calls`,
      {
        messaging_product: "whatsapp",
        to: cleanTo,
        type: type === "video" ? "video_call" : "audio_call",
      },
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    if (metaError) {
      console.error(`❌ Meta Calling API Error (${type}):`, JSON.stringify(metaError, null, 2));
    }
    throw error;
  }
};
