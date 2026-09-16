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
    
    // Make sure it's a page event (Lead Ads come through pages)
    if (body.object === "page") {
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
              return res.sendStatus(200); // Return 200 so Meta stops retrying
            }
            
            const accessToken = metaPage.pageAccessToken;
            
            const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${accessToken}`;
            
            try {
              const leadResponse = await axios.get(url);
              const leadData = leadResponse.data;
              
              let fullName = `Meta Lead ${leadgenId}`;
              let rawPhone = null;
              const customFields = {};
              
              // Parse field_data array
              if (leadData.field_data) {
                for (const field of leadData.field_data) {
                  const fieldName = field.name;
                  const fieldValue = field.values[0]; // Assuming single value
                  
                  if (fieldName === "full_name") {
                    fullName = fieldValue;
                  } else if (fieldName === "phone_number") {
                    rawPhone = fieldValue;
                  } else {
                    // Add other fields to customFields map
                    customFields[fieldName] = fieldValue;
                  }
                }
              }
              
              if (!rawPhone) {
                console.warn(`⚠️ No phone number found for Meta Lead ${leadgenId}. Skipping.`);
                continue;
              }
              
              const phone = normalizePhone(rawPhone);
              
              // Use mapped WhatsApp Account
              const accountId = metaPage.whatsappAccountId;
              
              // Find or create Contact
              let contact = await Contact.findOne({ phone });
              
              if (!contact) {
                contact = new Contact({
                  name: fullName,
                  phone,
                  source: "Meta Ads",
                  whatsappAccountId: accountId
                });
              } else {
                // Update existing contact safely
                if (contact.name.startsWith("User ") || contact.name.startsWith("Lead ") || !contact.name) {
                  contact.name = fullName;
                }
                if (contact.source === "Unassigned" || !contact.source) {
                  contact.source = "Meta Ads";
                }
              }
              
              // Merge custom fields without overriding existing ones (or you could override)
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
                // Check if a legacy unassigned conversation exists
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
              
              // Fetch fully populated conversation to emit
              const populatedConv = await Conversation.findById(conversation._id).populate("contact");
              
              // Emit live sync event
              smartEmit("new_contact", { contact });
              
              // We also emit a dummy new_message event or conversation_update so the sidebar updates
              getIO().emit("conversation_updated", populatedConv);
              
              console.log(`✅ Meta Lead successfully processed and synced: ${fullName} (${phone})`);
              
            } catch (apiErr) {
              console.error(`❌ Failed to fetch Meta Lead ${leadgenId} from Graph API:`, apiErr.response?.data || apiErr.message);
            }
          }
        }
      }
      return res.sendStatus(200);
    } else {
      console.log("ℹ️ Webhook is not for a 'page' object.");
      return res.sendStatus(404);
    }
  } catch (error) {
    console.error("❌ Error in handleMetaWebhook:", error);
    res.sendStatus(500);
  }
};
