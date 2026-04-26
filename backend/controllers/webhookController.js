import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
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
      const message = value?.messages?.[0];
      const status = value?.statuses?.[0];

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
              mediaUrl = await getMediaUrl(media.id);
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
          to: "me", // Changed from process.env.PHONE_NUMBER_ID for consistency
          body: bodyContent,
          type,
          mediaUrl,
          direction: "inbound"
        });
        await newMessage.save();

        let conversation = await Conversation.findOne({ phone: from });
        let contact = await Contact.findOne({ phone: from });
        
        // Extract Profile Name from Meta Webhook
        const profileName = value?.contacts?.[0]?.profile?.name;

        if (!contact) {
          contact = new Contact({ 
            name: profileName || `User ${from}`, 
            phone: from 
          });
          await contact.save();
        } else if (profileName && contact.name.startsWith("User ")) {
          // Update generic name with real profile name if found
          contact.name = profileName;
          await contact.save();
        }

        if (!conversation) {
          conversation = new Conversation({ contact: contact._id, phone: from });
        }
        
        conversation.lastMessage = bodyContent;
        conversation.lastMessageTime = new Date();
        conversation.lastCustomerMessageAt = new Date();
        conversation.unreadCount += 1;
        await conversation.save();

        // Populate contact before emitting
        const populatedConv = await Conversation.findById(conversation._id).populate("contact");

        // Notify UI about NEW MESSAGE (Smart Route)
        smartEmit("new_message", { message: newMessage, conversation: populatedConv });

        // 🤖 TRIGGER AUTOMATION (Chatbot)
        if (type === "text" || type === "interactive" || type === "button") {
          processAutoReply(from, bodyContent);
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
