import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_VERSION = "v21.0";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WABA_ID = process.env.WABA_ID;

const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const headers = {
  Authorization: `Bearer ${ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};

/**
 * Send a template message to a specific number
 */
export const sendTemplateMessage = async (to, templateName, languageCode = "en_US", components = []) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: components,
        },
      },
      { headers }
    );
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Create a new message template in Meta
 */
export const createTemplate = async (templateData) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/${WABA_ID}/message_templates`,
      templateData,
      { headers }
    );
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Fetch all templates or a specific one to check status
 */
export const getTemplates = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/${WABA_ID}/message_templates`, { headers });
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};export const sendTextMessage = async (to, text) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text },
      },
      { headers }
    );
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const sendImageMessage = async (to, imageUrl, caption = "") => {
  try {
    const res = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: {
          link: imageUrl,
          caption: caption
        },
      },
      { headers }
    );
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const deleteMetaTemplate = async (templateName) => {
  try {
    const res = await axios.delete(
      `${BASE_URL}/${WABA_ID}/message_templates?name=${templateName}`,
      { headers }
    );
    return res.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Get the download URL for a media file from WhatsApp
 */
export const getMediaUrl = async (mediaId) => {
  try {
    const res = await axios.get(`${BASE_URL}/${mediaId}`, { headers });
    return res.data.url;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Verify if a list of numbers are on WhatsApp
 */
export const verifyContacts = async (phones) => {
  try {
    // Meta requires format: ["91980...", "+1650..."]
    const res = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/contacts`,
      {
        blocking: "wait",
        contacts: phones,
        force_check: false
      },
      { headers }
    );
    return res.data.contacts;
  } catch (error) {
    throw error.response?.data || error;
  }
};
