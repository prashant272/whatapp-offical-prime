import mongoose from "mongoose";
import dotenv from "dotenv";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";

dotenv.config();

async function syncSectors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🚀 Connected to MongoDB for sector sync...");

    // Find conversations that have a sector assigned
    const conversations = await Conversation.find({ 
      sector: { $exists: true, $ne: "Unassigned" } 
    }).populate("contact");

    console.log(`🔍 Found ${conversations.length} conversations with custom sectors.`);

    let syncCount = 0;
    for (const conv of conversations) {
      if (conv.contact && conv.sector) {
        await Contact.findByIdAndUpdate(conv.contact._id, { sector: conv.sector });
        syncCount++;
      }
    }

    console.log(`✅ Sync complete. Updated ${syncCount} contacts.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Sync failed:", err);
    process.exit(1);
  }
}

syncSectors();
