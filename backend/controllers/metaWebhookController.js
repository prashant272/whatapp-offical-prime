import axios from "axios";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import MetaPage from "../models/MetaPage.js";
import { getIO, smartEmit } from "../utils/socket.js";
import { normalizePhone } from "../utils/phoneUtils.js";

// Verify Webhook for Meta Lead Ads
export const verifyMetaWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Use the standard webhook verify token from env
  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log("✅ Meta Lead Webhook Verified!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
};

// Handle incoming Meta Lead Webhook
export const handleMetaWebhook = async (req, res) => {
  console.log(" \n\n🔔 --- NEW META LEAD WEBHOOK REQUEST ---");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("-------------------------------\n");

  try {
    const body = req.body;
    
    // Make sure it's a page event
    if (body.object === "page") {
      // 1. Return 200 OK IMMEDIATELY to prevent Meta timeouts
      res.sendStatus(200);

      // 2. Process asynchronously in the background
      (async () => {
        try {
          for (const entry of body.entry) {
            for (const change of entry.changes) {
              if (change.field === "leadgen") {
                const leadgenId = change.value.leadgen_id;
                const formId = change.value.form_id;
                const pageId = change.value.page_id;
                
                console.log(`📩 Processing Meta Lead ID: ${leadgenId} from Page ID: ${pageId}`);
                
                // Find the MetaPage in database
                const metaPage = await MetaPage.findOne({ pageId });
                
                if (!metaPage) {
                  console.warn(`⚠️ No MetaPage found in DB for Page ID: ${pageId}. Cannot fetch lead details.`);
                  continue; // Continue instead of returning since response is already sent
                }
                
                const accessToken = metaPage.pageAccessToken;
                const accountId = metaPage.whatsappAccountId;
                
                // Fetch lead details from Facebook Graph API
                const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${accessToken}`;
                
                try {
                  const leadResponse = await axios.get(url);
                  const leadData = leadResponse.data;
                  
                  let fullName = `Meta Lead ${leadgenId}`;
                  let rawPhone = null;
                  const customFields = {};
                  
                  // Parse field_data array
                  if (leadData.field_data) {
                    leadData.field_data.forEach(field => {
                      if (field.name === "full_name" || field.name === "first_name") {
                        fullName = field.values[0];
                      } else if (field.name === "phone_number") {
                        rawPhone = field.values[0];
                      } else {
                        customFields[field.name] = field.values[0];
                      }
                    });
                  }
                  
                  if (!rawPhone) {
                    console.warn(`⚠️ No phone number found for Meta Lead ${leadgenId}. Skipping.`);
                    continue;
                  }
                  
                  const phone = normalizePhone(rawPhone);
                  
                  // Insert or Update Contact
                  let contact = await Contact.findOne({ phone, whatsappAccountId: accountId });
                  
                  if (!contact) {
                    contact = new Contact({
                      name: fullName,
                      phone,
                      source: "Meta Ads",
                      whatsappAccountId: accountId
                    });
                  } else {
                    if (contact.name.startsWith("User ") || contact.name.startsWith("Lead ") || !contact.name) {
                      contact.name = fullName;
                    }
                    if (contact.source === "Unassigned" || !contact.source) {
                      contact.source = "Meta Ads";
                    }
                  }
                  
                  for (const [key, val] of Object.entries(customFields)) {
                    if (!contact.customFields) {
                      contact.customFields = new Map();
                    }
                    contact.customFields.set(key, val);
                  }
                  
                  await contact.save();
                  
                  // Find or Create Conversation
                  let conversation = await Conversation.findOne({ phone, whatsappAccountId: accountId });
                  
                  if (!conversation) {
                    conversation = await Conversation.findOne({ phone, whatsappAccountId: null });
                  }
                  
                  if (!conversation) {
                    conversation = new Conversation({
                      contact: contact._id,
                      phone,
                      whatsappAccountId: accountId,
                      status: contact.status || "New",
                      assignedTo: contact.assignedTo,
                      source: contact.source
                    });
                  } else {
                    conversation.source = contact.source;
                  }
                  
                  await conversation.save();
                  
                  const populatedConv = await Conversation.findById(conversation._id).populate("contact");
                  
                  smartEmit("new_contact", { contact });
                  getIO().emit("conversation_updated", populatedConv);
                  
                  console.log(`✅ Meta Lead successfully processed and synced: ${fullName} (${phone})`);
                  
                } catch (apiErr) {
                  console.error(`❌ Failed to fetch Meta Lead ${leadgenId} from Graph API:`, apiErr.response?.data || apiErr.message);
                }
              }
            }
          }
        } catch (bgErr) {
           console.error("❌ Background Error in Meta Webhook:", bgErr);
        }
      })();

    } else {
      console.log("ℹ️ Webhook is not for a 'page' object.");
      return res.sendStatus(404);
    }
  } catch (error) {
    console.error("❌ Error in handleMetaWebhook:", error);
    // If headers already sent, don't send again
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
};
