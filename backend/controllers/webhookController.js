import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";

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
  console.log("---- WEBHOOK DEBUG START ----");
  console.log("BODY:", JSON.stringify(req.body, null, 2));
  console.log("---- WEBHOOK DEBUG END ----");

  const body = req.body;
  
  if (body.object === "whatsapp_business_account") {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        console.log(`✅ MATCHED MESSAGE: From ${message.from}`);
        const from = message.from; 
        const bodyContent = message.text?.body || "Non-text message received";

        const newMessage = new Message({
          from,
          to: process.env.PHONE_NUMBER_ID,
          body: bodyContent,
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

        console.log(`📩 SAVED! Message from ${from}: ${bodyContent}`);
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
