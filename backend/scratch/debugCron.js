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

  for (const rule of rules) {
    const delayMs = (rule.delayDays * 24 * 60 * 60 * 1000) + (rule.delayHours * 60 * 60 * 1000) + (rule.delayMinutes * 60 * 1000);
    
    console.log(`\nRule: ${rule.name} (Status: ${rule.status}, DelayMs: ${delayMs})`);
    
    const contacts = await Contact.find({
      status: rule.status,
      isBlocked: { $ne: true }
    }).populate("whatsappAccountId");
    console.log(`Found ${contacts.length} matching contacts for this status.`);

    for (const contact of contacts) {
      const logEntry = contact.followUpsLog?.find(log => log.ruleId.toString() === rule._id.toString());
      const lastTime = logEntry ? logEntry.lastSentAt : contact.statusUpdatedAt;
      
      console.log(`- Contact: ${contact.phone}, statusUpdatedAt: ${contact.statusUpdatedAt}, whatsappAccountId: ${contact.whatsappAccountId?._id || 'null'}`);
      console.log(`  lastTime evaluated: ${lastTime}`);
      if (lastTime) {
        const timeDiff = Date.now() - new Date(lastTime).getTime();
        console.log(`  Time diff: ${timeDiff} ms. Expected delay: ${delayMs} ms. Firing?: ${timeDiff >= delayMs}`);
        
        const accountToUse = contact.whatsappAccountId || rule.whatsappAccountId;
        console.log(`  Will use account: ${accountToUse?._id || 'none'}`);
      } else {
        console.log("  No lastTime. Skipping.");
      }
    }
  }

  const c = await Contact.findOne({ phone: "917350571911" });
  console.log(`Contact phone: ${c.phone}, status: ${c.status}, whatsappAccountId: ${c.whatsappAccountId}`);
  
  process.exit();
}

debug().catch(console.error);
