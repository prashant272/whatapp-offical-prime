import cron from "node-cron";
import FollowUpRule from "../models/FollowUpRule.js";
import Contact from "../models/Contact.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { sendTextMessage } from "../services/whatsappService.js";
import { smartEmit } from "./socket.js";

export const initAutomationCron = () => {
  // We use node-cron to run this function every 1 minute automatically in the background
  cron.schedule("* * * * *", async () => {
    try {
      // --- Business Hours Check (8 AM - 7 PM IST) ---
      const istHour = parseInt(new Date().toLocaleString("en-US", { hour: 'numeric', hour12: false, timeZone: "Asia/Kolkata" }));
      if (istHour < 8 || istHour >= 19) {
        // We pause automated follow-ups during the night in India.
        return; 
      }

      console.log("⏰ Running Follow-up Automation Check...");
      
      // Step 1: Find all Follow-up rules that are currently turned ON (active: true).
      // This is global, meaning it checks rules for all accounts at once.
      const activeRules = await FollowUpRule.find({ active: true });
      if (activeRules.length === 0) return; // If no rules are active, stop doing work and exit.

      // Step 2: Fetch the primary WhatsApp account.
      // We use this as a "backup plan" if a customer doesn't have an assigned account yet.
      const primaryAccount = await WhatsAppAccount.findOne({ $or: [{ isDefault: true }, { name: /primary/i }] });

      for (const rule of activeRules) {

        // Step 3: Calculate the total delay time in milliseconds (Days + Hours + Minutes).
        // This tells us exactly how long we need to wait before sending the message.
        const delayMs = (rule.delayDays * 24 * 60 * 60 * 1000) + 
                        (rule.delayHours * 60 * 60 * 1000) + 
                        (rule.delayMinutes * 60 * 1000);
        
        // We don't actually use thresholdDate right now, but it's good for debugging.
        const thresholdDate = new Date(Date.now() - delayMs);

        // Step 4: Find ALL customers (Contacts) who have the exact status we are looking for (e.g. "Interested").
        // We also make sure the customer is not blocked.
        // We "populate" whatsappAccountId so we know EXACTLY which account this customer belongs to.
        const contacts = await Contact.find({
          status: rule.status,
          isBlocked: { $ne: true }
        }).populate("whatsappAccountId");

        for (const contact of contacts) {
          // Step 5: Check if we ALREADY sent a follow-up for this specific rule to this customer.
          // If we did, we look at the last time we sent it (lastSentAt).
          // If we never sent it, we look at the time their status was changed (statusUpdatedAt).
          const logEntry = contact.followUpsLog?.find(log => log.ruleId.toString() === rule._id.toString());
          const lastTime = logEntry ? logEntry.lastSentAt : contact.statusUpdatedAt;

          // If there is no time recorded at all (old customer), we skip them to avoid spamming.
          if (!lastTime) continue;

          // Step 6: Check if enough time has passed. 
          // We check if (Current Time - Last Time) is greater than our Rule's Delay Time.
          // We subtract 10,000 milliseconds (10 seconds) as a safety buffer so the cron job doesn't accidentally skip a minute.
          if (Date.now() - new Date(lastTime).getTime() >= (delayMs - 10000)) {
            try {
              // Step 7: Decide which WhatsApp account to use.
              // First we try the customer's personal assigned account. If null, we use the primary fallback account.
              const accountToUse = contact.whatsappAccountId || primaryAccount;
              if (!accountToUse) continue; // If we STILL don't have an account, skip them.

              // Step 8: Actually SEND the WhatsApp message using the Official Meta API!
              const metaRes = await sendTextMessage(accountToUse, contact.phone, rule.messageText);
              
              // Step 9: Extract the unique WhatsApp Message ID to track if it gets "Read" or "Delivered" later.
              const messageId = metaRes?.messages?.[0]?.id;

              // Step 10: Save a copy of this message in our own Database so it shows up in the Chat UI.
              const newMessage = new Message({
                messageId,
                from: "me",
                to: contact.phone,
                body: rule.messageText,
                direction: "outbound",
                isAutomated: true, // Mark it as a bot message
                status: "sent",
                whatsappAccountId: accountToUse._id
              });
              await newMessage.save();

              const normalizedPhone = contact.phone.toString().replace(/\D/g, "");

              // Step 11: Update the Conversation view in the Chat UI.
              // This pushes the conversation to the top of the list and updates the "last message" text.
              const updatedConv = await Conversation.findOneAndUpdate(
                { phone: normalizedPhone, $or: [{ whatsappAccountId: accountToUse._id }, { whatsappAccountId: null }] },
                { 
                  lastMessage: rule.messageText, 
                  lastMessageTime: new Date(), 
                  unreadCount: 0,
                  whatsappAccountId: accountToUse._id
                },
                { upsert: true, new: true }
              ).populate("contact");

              // Step 12: Tell the Frontend (React) via WebSockets to instantly display the new message without refreshing the page!
              smartEmit("new_message", { message: newMessage, conversation: updatedConv });
              
              // Step 13: Log the time we sent this follow-up into the Customer's history.
              // This ensures the next cron cycle will wait for the exact delay time again before repeating!
              if (logEntry) {
                logEntry.lastSentAt = new Date();
                // This is a special Mongoose trick to force it to save nested arrays correctly.
                contact.markModified("followUpsLog");
              } else {
                // If this is the FIRST time we sent this rule, create a new history log.
                if (!contact.followUpsLog) contact.followUpsLog = [];
                contact.followUpsLog.push({ ruleId: rule._id, lastSentAt: new Date() });
              }
              // Save the updated customer history to the Database.
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
