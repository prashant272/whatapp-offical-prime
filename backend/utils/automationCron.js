import cron from "node-cron";
import FollowUpRule from "../models/FollowUpRule.js";
import Contact from "../models/Contact.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import { sendTextMessage } from "../services/whatsappService.js";

export const initAutomationCron = () => {
  // Run every minute to check for follow-ups
  cron.schedule("* * * * *", async () => {
    try {
      console.log("⏰ Running Follow-up Automation Check...");
      
      const activeRules = await FollowUpRule.find({ active: true }).populate("whatsappAccountId");
      if (activeRules.length === 0) return;

      for (const rule of activeRules) {
        if (!rule.whatsappAccountId) continue;

        const delayMs = (rule.delayDays * 24 * 60 * 60 * 1000) + 
                        (rule.delayHours * 60 * 60 * 1000) + 
                        (rule.delayMinutes * 60 * 1000);
        const thresholdDate = new Date(Date.now() - delayMs);

        // Find all contacts with matching status, not blocked.
        // We do the date filtering in memory to support repeating.
        const contacts = await Contact.find({
          whatsappAccountId: rule.whatsappAccountId._id,
          status: rule.status,
          isBlocked: { $ne: true }
        });

        for (const contact of contacts) {
          // Check the log for this rule to find the last sent time
          const logEntry = contact.followUpsLog?.find(log => log.ruleId.toString() === rule._id.toString());
          const lastTime = logEntry ? logEntry.lastSentAt : contact.statusUpdatedAt;

          // If there's no lastTime (e.g. status was set before this feature), skip or use createdAt
          if (!lastTime) continue;

          if (Date.now() - new Date(lastTime).getTime() >= delayMs) {
            try {
              await sendTextMessage(rule.whatsappAccountId, contact.phone, rule.messageText);
              
              if (logEntry) {
                // Update existing log
                logEntry.lastSentAt = new Date();
              } else {
                // Push new log
                if (!contact.followUpsLog) contact.followUpsLog = [];
                contact.followUpsLog.push({ ruleId: rule._id, lastSentAt: new Date() });
              }
              await contact.save();
              
              console.log(`✅ Repeated Follow-up sent to ${contact.phone} for rule: ${rule.name}`);
              
              // Wait 2 seconds between messages to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (err) {
              console.error(`❌ Failed to send follow-up to ${contact.phone}:`, err.message);
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Error in Follow-up Automation Cron:", error);
    }
  });
  
  console.log("📅 Follow-up Automation Cron initialized.");
};
