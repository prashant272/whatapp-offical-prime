import mongoose from "mongoose";
import dotenv from "dotenv";
import FollowUpRule from "../models/FollowUpRule.js";
import Contact from "../models/Contact.js";

dotenv.config({ path: "e:/whatapp-offical/backend/.env" });

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const rules = await FollowUpRule.find({});
  console.log("All Rules in DB:", rules);

  const contacts = await Contact.find({ status: { $ne: null } }).select("phone status statusUpdatedAt followUpsLog");
  console.log("Contacts with Status:");
  contacts.forEach(c => console.log(`- ${c.phone}: ${c.status} (Updated: ${c.statusUpdatedAt}) Log: ${JSON.stringify(c.followUpsLog)}`));

  process.exit();
}

debug().catch(console.error);
