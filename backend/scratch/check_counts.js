import mongoose from "mongoose";
import dotenv from "dotenv";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

dotenv.config({ path: '.env' });

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const totalContacts = await Contact.countDocuments();
    console.log(`Total Contacts: ${totalContacts}`);

    const contactsWithStatus = await Contact.countDocuments({ status: { $exists: true, $ne: null, $ne: "" } });
    console.log(`Contacts with any status: ${contactsWithStatus}`);

    const totalConversations = await Conversation.countDocuments();
    console.log(`Total Conversations: ${totalConversations}`);

    const conversationsWithStatus = await Conversation.countDocuments({ status: { $exists: true, $ne: null, $ne: "" } });
    console.log(`Conversations with any status: ${conversationsWithStatus}`);

    const totalMessages = await Message.countDocuments();
    console.log(`Total Messages: ${totalMessages}`);
    
    const contactStatusCounts = await Contact.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    console.log("Contact status breakdown:", contactStatusCounts);
    
    // Group conversations by status
    const convStatusCounts = await Conversation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    console.log("Conversation status breakdown:", convStatusCounts);

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
};

run();
