import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import { normalizePhone } from "../utils/phoneUtils.js";
import { getMediaUrl } from "../services/whatsappService.js";
import { getIO, smartEmit } from "../utils/socket.js";
import { processAutoReply } from "../utils/automationHelper.js";

export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log("✅ Webhook Verified!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
};

export const handleWebhook = async (req, res) => {
  console.log(" \n\n🔔 --- NEW WEBHOOK REQUEST ---");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("-------------------------------\n");

  const body = req.body;
  
  if (body.object === "whatsapp_business_account") {
    try {
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const metadata = value?.metadata;
      const message = value?.messages?.[0];
      const status = value?.statuses?.[0];

      // Find which account this belongs to
      const phoneNumberId = metadata?.phone_number_id;
      console.log(`📩 Webhook received for Phone ID: ${phoneNumberId}`);
      const account = await WhatsAppAccount.findOne({ phoneNumberId });
      
      if (!account) {
        console.warn(`⚠️ No account found in DB for Phone ID: ${phoneNumberId}. Message ignored.`);
        return res.sendStatus(200); 
      }
      console.log(`✅ Webhook matched to Account: ${account.name}`);
      
      if (!account && (message || status)) {
        console.warn(`⚠️ Received message for unknown Phone Number ID: ${phoneNumberId}`);
        // Optional: you could still process it, but let's stick to known accounts
      }

      if (status) {
        console.log(`📈 Status Update: ${status.status} for ${status.id}`);
        await Message.findOneAndUpdate(
          { messageId: status.id },
          { status: status.status }
        );

        // Notify UI about status update
        const io = getIO();
        io.emit("status_update", { messageId: status.id, status: status.status });

        return res.sendStatus(200);
      }

      if (message) {
        const from = normalizePhone(message.from); 
        let bodyContent = "";
        let type = message.type || "text";

        let mediaUrl = null;

        if (type === "text") {
          bodyContent = message.text?.body;
        } else if (type === "button") {
          bodyContent = message.button?.text;
        } else if (type === "interactive") {
          const interactive = message.interactive;
          bodyContent = interactive?.button_reply?.title || interactive?.list_reply?.title || interactive?.button_reply?.id;
        } else if (type === "image" || type === "video" || type === "audio" || type === "document") {
          const media = message[type];
          bodyContent = media?.caption || `${type.charAt(0).toUpperCase() + type.slice(1)} received`;
          if (media?.id) {
            try {
              mediaUrl = await getMediaUrl(account, media.id);
            } catch (err) {
              console.error(`Error fetching ${type} URL:`, err);
            }
          }
        }

        // Final fallback if nothing worked
        if (!bodyContent) {
          bodyContent = `Received ${type} message`;
        }

        console.log(`📩 PROCESSED: [${type}] "${bodyContent}" from ${from}`);

        const newMessage = new Message({
          messageId: message.id,
          from,
          to: "me",
          body: bodyContent,
          type,
          mediaUrl,
          direction: "inbound",
          whatsappAccountId: account?._id
        });
        await newMessage.save();

        // Step 1: Find or Create Contact (Always normalize phone)
        let contact = await Contact.findOne({ phone: from });
        
        // Step 2: Find existing Conversation (Checking both current account and unassigned/legacy)
        let conversation = await Conversation.findOne({ 
          phone: from, 
          $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] 
        });
        
        // Extract Profile Name from Meta Webhook
        const profileName = value?.contacts?.[0]?.profile?.name;

        if (!contact) {
          contact = new Contact({ 
            name: profileName || `User ${from}`, 
            phone: from 
          });
        } else if (profileName && contact.name.startsWith("User ")) {
          // Update generic name with real profile name if found
          contact.name = profileName;
        }

        // Step 3: Check if the user typed "yes", "no", or "stop".
        // This is a built-in hardcoded automation to automatically update customer status.
        const textContent = bodyContent.trim().toLowerCase();
        let statusUpdated = false;
        if (textContent === "yes") {
          contact.status = "Interested";
          contact.statusUpdatedAt = new Date(); // Record time so the Follow-up Cron knows when to start counting
          statusUpdated = true;
        } else if (textContent === "no") {
          contact.status = "Not Interested";
          contact.statusUpdatedAt = new Date();
          statusUpdated = true;
        } else if (textContent === "stop") {
          contact.isBlocked = true; // Prevents the Cron Job and Campaigns from messaging this number
        }

        await contact.save();

        if (!conversation) {
          conversation = new Conversation({ 
            contact: contact._id, 
            phone: from,
            whatsappAccountId: account?._id,
            status: contact.status || "New" // Sync status from contact if it's a fresh conversation record
          });
        }
        
        // Step 4: Update the Conversation and CLAIM it for this account
        conversation.whatsappAccountId = account?._id;
        conversation.lastMessage = bodyContent;
        conversation.lastMessageTime = new Date();
        conversation.lastCustomerMessageAt = new Date();
        conversation.unreadCount += 1;
        
        // Step 5: If the status changed because they typed "yes" or "no", update the Conversation status too!
        if (statusUpdated) {
          conversation.status = contact.status;
        }

        await conversation.save();

        // Populate contact before emitting
        const populatedConv = await Conversation.findById(conversation._id).populate("contact");

        // Step 6: Notify the frontend UI instantly via WebSockets to show the new message without refreshing
        smartEmit("new_message", { message: newMessage, conversation: populatedConv });

        // Step 7: TRIGGER AUTOMATION (Chatbot AutoReplies)
        // Checks if the user's message matches any keyword rules created in the AutoReply UI.
        if (type === "text" || type === "interactive" || type === "button") {
          processAutoReply(account, from, bodyContent, contact);
        }
      }
      res.sendStatus(200);
    } catch (err) {
      console.error("❌ CRITICAL WEBHOOK ERROR:", err);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(404);
  }
};
