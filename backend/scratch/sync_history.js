import mongoose from "mongoose";
import dotenv from "dotenv";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";

dotenv.config({ path: "e:/whatapp-offical/backend/.env" });

async function sync() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const conversations = await Conversation.find({ status: { $ne: "New" } });
  let count = 0;

  for (const conv of conversations) {
    if (conv.contact) {
      await Contact.findByIdAndUpdate(conv.contact, {
        status: conv.status,
        statusUpdatedAt: new Date(Date.now() - 60000) // 1 min ago so it triggers immediately if delay is 0
      });
      count++;
    }
  }

  console.log(`Synced ${count} historical conversations to contacts.`);
  process.exit();
}

sync().catch(console.error);
