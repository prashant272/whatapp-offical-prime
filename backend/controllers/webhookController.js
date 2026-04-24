import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
import { normalizePhone } from "../utils/phoneUtils.js";

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
        console.log(`📈 Message Status Update: ${status.status} for ${status.id}`);
        return res.sendStatus(200);
      }

      if (message) {
        const from = normalizePhone(message.from); 
        let bodyContent = "";
        let type = message.type || "text";

        if (type === "text") {
          bodyContent = message.text?.body;
        } else if (type === "button") {
          bodyContent = message.button?.text;
        } else if (type === "interactive") {
          const interactive = message.interactive;
          bodyContent = interactive?.button_reply?.title || interactive?.list_reply?.title || interactive?.button_reply?.id;
        } else if (type === "image") {
          bodyContent = message.image?.caption || "Image received";
        }

        // Final fallback if nothing worked
        if (!bodyContent) {
          bodyContent = `Received ${type} message`;
        }

        console.log(`📩 PROCESSED: [${type}] "${bodyContent}" from ${from}`);

        const newMessage = new Message({
          from,
          to: process.env.PHONE_NUMBER_ID,
          body: bodyContent,
          type,
          direction: "inbound"
        });
        await newMessage.save();

        let conversation = await Conversation.findOne({ phone: from });
        if (!conversation) {
          let contact = await Contact.findOne({ phone: from });
          if (!contact) {
            contact = new Contact({ name: `User ${from}`, phone: from });
            await contact.save();
          }
          conversation = new Conversation({ contact: contact._id, phone: from });
        }
        
        conversation.lastMessage = bodyContent;
        conversation.lastMessageTime = new Date();
        conversation.unreadCount += 1;
        await conversation.save();
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
