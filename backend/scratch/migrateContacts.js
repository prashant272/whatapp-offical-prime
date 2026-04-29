import mongoose from "mongoose";
import dotenv from "dotenv";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";

dotenv.config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🚀 Connected to MongoDB for migration...");

    const contacts = await Contact.find({ whatsappAccountId: null });
    console.log(`🔍 Found ${contacts.length} contacts missing whatsappAccountId.`);

    let fixedCount = 0;
    for (const contact of contacts) {
      // Find a conversation for this contact to get the account ID
      const conv = await Conversation.findOne({ contact: contact._id });
      if (conv && conv.whatsappAccountId) {
        contact.whatsappAccountId = conv.whatsappAccountId;
        await contact.save();
        fixedCount++;
      }
    }

    console.log(`✅ Migration complete. Fixed ${fixedCount} contacts.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
