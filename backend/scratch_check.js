import mongoose from "mongoose";
import dotenv from "dotenv";
import Contact from "./models/Contact.js";
import Conversation from "./models/Conversation.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");
  
  const phone = "919801017333";
  const contact = await Contact.findOne({ phone });
  console.log("CONTACT:", JSON.stringify(contact, null, 2));
  
  const conv = await Conversation.findOne({ phone });
  console.log("CONVERSATION:", JSON.stringify(conv, null, 2));
  
  await mongoose.disconnect();
}

run();
