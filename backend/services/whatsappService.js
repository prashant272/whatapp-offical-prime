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

export const sendTextMessage = async (account, to, text, quotedMessageId = null) => {
  let cleanTo = to.toString().replace(/\D/g, "");
  if (cleanTo.length === 10) cleanTo = "91" + cleanTo;
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
      type: "text",
      text: { body: text },
    };
    if (quotedMessageId) {
      payload.context = { message_id: quotedMessageId };
    }
    console.log(`📤 Sending payload to Meta:`, JSON.stringify(payload, null, 2));
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/messages`,
      payload,
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    if (metaError) {
      console.error(`❌ Meta API Error (Text):`, JSON.stringify(metaError, null, 2));
    } else {
      console.error("❌ Network/Axios Error (Text):", error.message);
    }
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
    const metaError = error.response?.data?.error;
    if (metaError) {
      console.error("❌ Meta API Error (Image):", JSON.stringify(metaError, null, 2));
    }
    throw error;
  }
};

export const sendDocumentMessage = async (account, to, documentUrl, filename = "document.pdf", caption = "") => {
  let cleanTo = to.toString().replace(/\D/g, "");
  if (cleanTo.length === 10) cleanTo = "91" + cleanTo;

  console.log(`📤 Attempting to send Document to ${cleanTo}`);
  console.log(`📄 URL: ${documentUrl}`);
  console.log(`📎 Filename: ${filename}`);

  try {
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "document",
        document: {
          link: documentUrl,
          caption: caption || undefined,
          filename: filename
        },
      },
      { headers: getHeaders(account.accessToken) }
    );
    console.log(`✅ Document sent successfully! ID: ${res.data.messages?.[0]?.id}`);
    return res.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    if (metaError) {
      console.error("❌ Meta API Error (Document):", JSON.stringify(metaError, null, 2));
    } else {
      console.error("❌ Network/Axios Error (Document):", error.message);
    }
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

/**
 * Uploads a file from a URL to Meta and returns a header_handle for template creation.
 */
export const uploadMediaToMeta = async (accessToken, fileUrl) => {
  try {
    console.log(`📥 Downloading sample media from: ${fileUrl}`);
    const fileRes = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const fileData = Buffer.from(fileRes.data);
    const contentType = fileRes.headers["content-type"] || "image/jpeg";
    const fileLength = fileData.length;

    const APP_ID = "4777118855760718"; // Found via debug_token

    // Step 1: Create Upload Session
    console.log(`🚀 Creating Meta Upload Session (Size: ${fileLength} bytes)`);
    const sessionRes = await axios.post(
      `https://graph.facebook.com/v21.0/${APP_ID}/uploads`,
      null,
      {
        params: {
          file_name: "template_sample",
          file_length: fileLength,
          file_type: contentType,
          access_token: accessToken
        }
      }
    );
    const sessionId = sessionRes.data.id;

    // Step 2: Upload Data
    console.log(`📤 Uploading bytes to Meta Session: ${sessionId}`);
    const uploadRes = await axios.post(
      `https://graph.facebook.com/v21.0/${sessionId}`,
      fileData,
      {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          "Content-Type": contentType
        }
      }
    );

    console.log(`✅ Meta Media Handle Obtained: ${uploadRes.data.h}`);
    return uploadRes.data.h;
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error("❌ Meta Upload Failed:", JSON.stringify(errData, null, 2));
    throw new Error(`Meta media upload failed: ${error.response?.data?.error?.message || error.message}`);
  }
};

export const blockUser = async (account, phoneToBlock) => {
  let cleanTo = phoneToBlock.toString().replace(/\D/g, "");
  if (cleanTo.length === 10) cleanTo = "91" + cleanTo;
  try {
    const res = await axios.post(
      `${BASE_URL}/${account.phoneNumberId}/block_users`,
      {
        messaging_product: "whatsapp",
        block_users: [
          {
            user: cleanTo
          }
        ]
      },
      { headers: getHeaders(account.accessToken) }
    );
    return res.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    if (metaError) {
      console.error(`❌ Meta API Error (Block User: ${cleanTo}):`, JSON.stringify(metaError, null, 2));
    }
    throw error;
  }
};

export const unblockUser = async (account, phoneToUnblock) => {
  let cleanTo = phoneToUnblock.toString().replace(/\D/g, "");
  if (cleanTo.length === 10) cleanTo = "91" + cleanTo;
  try {
    const res = await axios.delete(
      `${BASE_URL}/${account.phoneNumberId}/block_users`,
      {
        headers: getHeaders(account.accessToken),
        data: {
          messaging_product: "whatsapp",
          block_users: [
            {
              user: cleanTo
            }
          ]
        }
      }
    );
    return res.data;
  } catch (error) {
    const metaError = error.response?.data?.error;
    if (metaError) {
      console.error(`❌ Meta API Error (Unblock User: ${cleanTo}):`, JSON.stringify(metaError, null, 2));
    }
    throw error;
  }
};
