import mongoose from "mongoose";
import dotenv from "dotenv";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB for migration...");

    const conversations = await Conversation.find();
    console.log(`Checking ${conversations.length} conversations...`);

    for (const conv of conversations) {
      const lastInbound = await Message.findOne({ 
        $or: [{ from: conv.phone }, { to: conv.phone }],
        direction: "inbound"
      }).sort({ timestamp: -1 });

      if (lastInbound) {
        conv.lastCustomerMessageAt = lastInbound.timestamp;
        await conv.save();
        console.log(`Updated ${conv.phone} with last customer message at ${lastInbound.timestamp}`);
      }
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

migrate();
