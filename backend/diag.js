import mongoose from "mongoose";
import dotenv from "dotenv";
import Campaign from "./models/Campaign.js";
import Message from "./models/Message.js";
import connectDB from "./config/db.js";

dotenv.config();

const diag = async () => {
  await connectDB();
  const camp = await Campaign.findOne({ status: "COMPLETED" }).sort({ createdAt: -1 });
  if (camp && camp.logs.length > 0) {
    console.log(`Campaign: ${camp.name}`);
    console.log(`First Log Phone: ${camp.logs[0].phone}`);
    console.log(`First Log Status: ${camp.logs[0].status}`);
    console.log(`First Log Time: ${camp.logs[0].sentAt}`);
    
    // Find matching message
    const cleanPhone = camp.logs[0].phone.replace(/\D/g, "");
    const last10 = cleanPhone.slice(-10);
    
    const msg = await Message.findOne({
      to: new RegExp(last10 + "$"),
      direction: "outbound"
    }).sort({ createdAt: -1 });
    
    if (msg) {
      console.log(`Found matching message: status=${msg.status}, to=${msg.to}, time=${msg.createdAt}`);
    } else {
      console.log("No matching message found for this phone.");
    }
  }
  process.exit(0);
};
diag();
