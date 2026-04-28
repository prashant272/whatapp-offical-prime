import cron from "node-cron";
import FollowUpRule from "../models/FollowUpRule.js";
import Contact from "../models/Contact.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { sendTextMessage } from "../services/whatsappService.js";
import { smartEmit } from "./socket.js";

export const initAutomationCron = () => {
  // Run every minute to check for follow-ups
  cron.schedule("* * * * *", async () => {
    try {
      console.log("⏰ Running Follow-up Automation Check...");
      
      const activeRules = await FollowUpRule.find({ active: true });
      if (activeRules.length === 0) return;

      const primaryAccount = await WhatsAppAccount.findOne({ $or: [{ isDefault: true }, { name: /primary/i }] });

      for (const rule of activeRules) {

        const delayMs = (rule.delayDays * 24 * 60 * 60 * 1000) + 
                        (rule.delayHours * 60 * 60 * 1000) + 
                        (rule.delayMinutes * 60 * 1000);
        const thresholdDate = new Date(Date.now() - delayMs);

        // Find all contacts with matching status, not blocked, regardless of account.
        // Populate their whatsappAccountId so we can send the message from their specific account.
        const contacts = await Contact.find({
          status: rule.status,
          isBlocked: { $ne: true }
        }).populate("whatsappAccountId");

        for (const contact of contacts) {
          // Check the log for this rule to find the last sent time
          const logEntry = contact.followUpsLog?.find(log => log.ruleId.toString() === rule._id.toString());
          const lastTime = logEntry ? logEntry.lastSentAt : contact.statusUpdatedAt;

          // If there's no lastTime (e.g. status was set before this feature), skip or use createdAt
          if (!lastTime) continue;

          // Subtract 10 seconds from delayMs to account for cron execution jitter
          if (Date.now() - new Date(lastTime).getTime() >= (delayMs - 10000)) {
            try {
              const accountToUse = contact.whatsappAccountId || primaryAccount;
              if (!accountToUse) continue;

              const metaRes = await sendTextMessage(accountToUse, contact.phone, rule.messageText);
              
              // Extract message ID to track status
              const messageId = metaRes?.messages?.[0]?.id;

              // Save to database
              const newMessage = new Message({
                messageId,
                from: "me",
                to: contact.phone,
                body: rule.messageText,
                direction: "outbound",
                isAutomated: true,
                status: "sent",
                whatsappAccountId: accountToUse._id
              });
              await newMessage.save();

              // Update conversation
              const updatedConv = await Conversation.findOneAndUpdate(
                { phone: contact.phone, $or: [{ whatsappAccountId: accountToUse._id }, { whatsappAccountId: null }] },
                { 
                  lastMessage: rule.messageText, 
                  lastMessageTime: new Date(), 
                  unreadCount: 0,
                  whatsappAccountId: accountToUse._id
                },
                { upsert: true, new: true }
              ).populate("contact");

              // Emit to UI
              smartEmit("new_message", { message: newMessage, conversation: updatedConv });
              
              if (logEntry) {
                // Update existing log
                logEntry.lastSentAt = new Date();
                contact.markModified("followUpsLog");
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
