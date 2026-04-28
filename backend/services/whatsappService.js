import axios from "axios";

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const getHeaders = (accessToken) => {
  if (accessToken) {
    console.log(`🔑 Using Token: ${accessToken.substring(0, 7)}...${accessToken.substring(accessToken.length - 5)}`);
  } else {
    console.log("⚠️ No Access Token provided for this request!");
  }
  // This header proves to Meta that we are authorized to send messages on behalf of the selected account.
  return {
    Authorization: `Bearer ${accessToken?.trim()}`,
    "Content-Type": "application/json",
  };
};

export const sendTemplateMessage = async (account, to, templateName, languageCode = "en_US", components = []) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const sendTextMessage = async (account, to, text) => {
  try {
    // Sends a simple Text message (like what humans type) to the customer using Meta's Cloud API.
    // The "account.phoneNumberId" ensures the message comes from the correct specific WhatsApp number.
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
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
  try {
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
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
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/contacts`,
      {
        blocking: "wait",
        contacts: phones,
        force_check: false
      },
      { headers: getHeaders(account.accessToken) }
    );
    return res.data.contacts;
  } catch (error) {
    throw error;
  }
};
