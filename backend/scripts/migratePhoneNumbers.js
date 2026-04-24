import mongoose from "mongoose";
import dotenv from "dotenv";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
import { normalizePhone } from "../utils/phoneUtils.js";

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🚀 Connected to MongoDB for migration...");

    // 1. Normalize all Contacts (Bulk)
    const contacts = await Contact.find();
    console.log(`Processing ${contacts.length} contacts...`);
    for (const contact of contacts) {
      const normalized = normalizePhone(contact.phone);
      if (normalized !== contact.phone) {
        const existing = await Contact.findOne({ phone: normalized });
        if (existing) {
          await Contact.deleteOne({ _id: contact._id });
        } else {
          await Contact.updateOne({ _id: contact._id }, { $set: { phone: normalized } });
        }
      }
    }

    // 2. Normalize all Messages (Bulk Update)
    console.log("Normalizing all messages...");
    // Update all inbound messages
    await Message.updateMany(
      { direction: "inbound", from: { $not: /^91/ } },
      [{ $set: { from: { $concat: ["91", "$from"] } } }]
    );
    // Update all outbound messages
    await Message.updateMany(
      { direction: "outbound", to: { $not: /^91/ } },
      [{ $set: { to: { $concat: ["91", "$to"] } } }]
    );

    // 3. Merge Conversations
    const conversations = await Conversation.find();
    console.log(`Processing ${conversations.length} conversations...`);
    for (const conv of conversations) {
      const normalized = normalizePhone(conv.phone);
      if (normalized !== conv.phone) {
        const existing = await Conversation.findOne({ phone: normalized });
        if (existing) {
          console.log(`Merging ${conv.phone} -> ${normalized}`);
          await Conversation.deleteOne({ _id: conv._id });
        } else {
          await Conversation.updateOne({ _id: conv._id }, { $set: { phone: normalized } });
        }
      }
    }

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

migrate();
