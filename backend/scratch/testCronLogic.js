import mongoose from "mongoose";
import dotenv from "dotenv";
import FollowUpRule from "../models/FollowUpRule.js";
import Contact from "../models/Contact.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";

dotenv.config({ path: "e:/whatapp-offical/backend/.env" });

async function testCron() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const activeRules = await FollowUpRule.find({ active: true });
  const primaryAccount = await WhatsAppAccount.findOne({ $or: [{ isDefault: true }, { name: /primary/i }] });

  for (const rule of activeRules) {
    const delayMs = (rule.delayDays * 24 * 60 * 60 * 1000) + (rule.delayHours * 60 * 60 * 1000) + (rule.delayMinutes * 60 * 1000);
    
    const contacts = await Contact.find({
      status: rule.status,
      phone: "919801017333"
    }).populate("whatsappAccountId");

    for (const contact of contacts) {
      const logEntry = contact.followUpsLog?.find(log => log.ruleId.toString() === rule._id.toString());
      const lastTime = logEntry ? logEntry.lastSentAt : contact.statusUpdatedAt;

      console.log(`Evaluating Rule ${rule.name} for ${contact.phone}`);
      console.log(`lastTime: ${lastTime}`);
      
      if (!lastTime) continue;

      const diff = Date.now() - new Date(lastTime).getTime();
      console.log(`Diff: ${diff} ms. Expected delay: ${delayMs} ms`);

      if (diff >= delayMs) {
        console.log("WOULD FIRE!");
        // Simulate update
        if (logEntry) {
          logEntry.lastSentAt = new Date();
          contact.markModified("followUpsLog"); // FIX
        }
      } else {
        console.log("NOT FIRING. Delay not met.");
      }
    }
  }

  process.exit();
}

testCron();
