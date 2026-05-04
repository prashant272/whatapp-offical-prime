import axios from "axios";

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const getHeaders = (accessToken) => {
  if (accessToken) {
    console.log(`🔑 Using Token: ${accessToken.substring(0, 7)}...${accessToken.substring(accessToken.length - 5)}`);
  } else {
    console.log("⚠️ No Access Token provided for this request!");
  }
  return {
    Authorization: `Bearer ${accessToken?.trim()}`,
    "Content-Type": "application/json",
  };
};

export const sendTemplateMessage = async (account, to, templateName, languageCode, components = []) => {
  // If no languageCode provided, fallback to "en_US" safely
  const finalLang = languageCode || "en_US";
  let cleanTo = to.toString().replace(/\D/g, "");
  if (cleanTo.length === 10) cleanTo = "91" + cleanTo;

  try {
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: cleanTo,
        type: "template",
        template: {
          name: templateName,
          language: { code: finalLang },
          components,
        },
      },
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    if (metaError) {
      console.error(`❌ Meta API Error (Template: ${templateName}):`, JSON.stringify(metaError, null, 2));
    }
    throw error;
  }
};

export const sendTextMessage = async (account, to, text) => {
  let cleanTo = to.toString().replace(/\D/g, "");
  if (cleanTo.length === 10) cleanTo = "91" + cleanTo;
  try {
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: { body: text },
      },
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const sendImageMessage = async (account, to, imageUrl, caption = "") => {
  let cleanTo = to.toString().replace(/\D/g, "");
  if (cleanTo.length === 10) cleanTo = "91" + cleanTo;
  try {
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "image",
        image: { link: imageUrl, caption },
      },
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getMediaUrl = async (account, mediaId) => {
  try {
    const res = await axios.get(`${BASE_URL}/${mediaId}`, { headers: getHeaders(account.accessToken) });
    return res.data.url;
  } catch (error) {
    throw error;
  }
};

export const getTemplates = async (account) => {
  try {
    const res = await axios.get(`${BASE_URL}/${account.wabaId}/message_templates`, { headers: getHeaders(account.accessToken) });
    return res.data.data || [];
  } catch (error) {
    throw error;
  }
};

export const createTemplate = async (account, templateData) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/${account.wabaId}/message_templates`,
      templateData,
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const deleteMetaTemplate = async (account, templateName) => {
  try {
    const res = await axios.delete(
      `${BASE_URL}/${account.wabaId}/message_templates?name=${templateName}`,
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const verifyContacts = async (account, phones) => {
  try {
    const cleanPhones = phones.map(p => p.toString().replace(/\D/g, ""));
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/contacts`,
      {
        blocking: "wait",
        contacts: cleanPhones.map(cp => cp.startsWith("+") ? cp : `+${cp}`),
        force_check: false
      },
      { headers: getHeaders(account.accessToken) }
    );
    return res.data.contacts;
  } catch (error) {
    throw error;
  }
};
