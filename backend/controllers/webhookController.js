import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import Campaign from "../models/Campaign.js";
import { normalizePhone } from "../utils/phoneUtils.js";
import { getMediaUrl } from "../services/whatsappService.js";
import { getIO, smartEmit } from "../utils/socket.js";
import { processAutoReply, getSimilarity, matchKeyword } from "../utils/automationHelper.js";
import KeywordRule from "../models/KeywordRule.js";

export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log("✅ Webhook Verified!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
};

export const handleWebhook = async (req, res) => {
  console.log(" \n\n🔔 --- NEW WEBHOOK REQUEST ---");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("-------------------------------\n");

  const body = req.body;
  
  if (body.object === "whatsapp_business_account") {
    try {
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const metadata = value?.metadata;
      const message = value?.messages?.[0];
      const status = value?.statuses?.[0];

      // Find which account this belongs to
      const phoneNumberId = metadata?.phone_number_id;
      console.log(`📩 Webhook received for Phone ID: ${phoneNumberId}`);
      const account = await WhatsAppAccount.findOne({ phoneNumberId });
      
      if (!account) {
        console.warn(`⚠️ No account found in DB for Phone ID: ${phoneNumberId}. Message ignored.`);
        return res.sendStatus(200); 
      }
      console.log(`✅ Webhook matched to Account: ${account.name}`);
      
      if (!account && (message || status)) {
        console.warn(`⚠️ Received message for unknown Phone Number ID: ${phoneNumberId}`);
        // Optional: you could still process it, but let's stick to known accounts
      }

      if (status) {
        console.log(`📈 Status Update: ${status.status} for ${status.id}`);
        const updateFields = { status: status.status };
        if (status.status === "failed" && status.errors && status.errors[0]) {
          updateFields.error = status.errors[0].message || status.errors[0].title || "Delivery Failed";
        }

        // Soft delete contact if delivery failed due to being undeliverable
        if (status.status === "failed") {
          const errMsg = (status.errors && status.errors[0])
            ? (status.errors[0].message || status.errors[0].title || "")
            : "";
          if (errMsg.toLowerCase().includes("undeliverable")) {
            const recipientPhone = normalizePhone(status.recipient_id);
            if (recipientPhone) {
              await Contact.updateMany({ phone: recipientPhone }, { $set: { isDeleted: true } });
              console.log(`🗑️ Soft deleted contact ${recipientPhone} due to undeliverable message webhook.`);
            }
          }
        }
        const updatedMsg = await Message.findOneAndUpdate(
          { messageId: status.id },
          { 
            $set: updateFields,
            $setOnInsert: { 
              messageId: status.id, 
              direction: "outbound",
              from: "me",
              to: status.recipient_id || "",
              body: "Template Message", // placeholder body in case we don't have it yet
              whatsappAccountId: account._id
            }
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // SYNC WITH CAMPAIGN LOGS (ATOMIC UPDATE TO PREVENT CONCURRENCY OVERWRITES)
        let campaignId = updatedMsg?.campaignId;
        let targetPhone = updatedMsg?.to?.replace(/\D/g, "");

        if (!campaignId) {
          try {
            const campaignByMsgId = await Campaign.findOne(
              { "logs.messageId": status.id },
              { _id: 1, "logs.$": 1 }
            );
            if (campaignByMsgId) {
              campaignId = campaignByMsgId._id;
              if (campaignByMsgId.logs && campaignByMsgId.logs[0]) {
                targetPhone = campaignByMsgId.logs[0].phone;
              }
              console.log(`🎯 Match found directly by logs.messageId: ${status.id} inside Campaign ID: ${campaignId}`);
            }
          } catch (findErr) {
            console.error("⚠️ Error looking up campaign by message ID:", findErr.message);
          }
        }

        if (campaignId && targetPhone) {
          try {
            const targetPhoneStr = targetPhone.replace(/\D/g, "");
            const stripped = targetPhoneStr.replace(/^91/, "");
            const withCode = targetPhoneStr.startsWith("91") ? targetPhoneStr : `91${targetPhoneStr}`;
            const targetPhoneFormats = [targetPhoneStr, stripped, withCode];

            // 1. Fetch matching log entry and old status using MongoDB positional projection ($)
            const campaignForCount = await Campaign.findOne(
              { _id: campaignId, "logs.phone": { $in: targetPhoneFormats } },
              { "logs.$": 1, sentCount: 1, failedCount: 1, status: 1 }
            );

            if (campaignForCount && campaignForCount.logs && campaignForCount.logs[0]) {
              const matchedLog = campaignForCount.logs[0];
              const oldStatus = matchedLog.status;
              const newStatus = status.status;

              // Only update if status has actually changed
              if (oldStatus !== newStatus) {
                const updateQuery = {};
                const incQuery = {};

                // Update failed/sent counts atomically
                if (newStatus === "failed" && oldStatus !== "failed") {
                  incQuery.failedCount = 1;
                  incQuery.sentCount = -1;
                } else if (oldStatus === "failed" && newStatus !== "failed") {
                  incQuery.failedCount = -1;
                  incQuery.sentCount = 1;
                }

                updateQuery.$set = {
                  "logs.$.status": newStatus,
                  "logs.$.error": (status.errors && status.errors[0])
                    ? (status.errors[0].message || status.errors[0].title || "Delivery Failed")
                    : (newStatus === "failed" ? "Delivery Failed" : undefined)
                };

                if (Object.keys(incQuery).length > 0) {
                  updateQuery.$inc = incQuery;
                }

                // 2. Perform atomic update using positional operator $
                const updatedCampaign = await Campaign.findOneAndUpdate(
                  { _id: campaignId, "logs.phone": matchedLog.phone },
                  updateQuery,
                  { new: true }
                );

                if (updatedCampaign) {
                  // Emit campaign update
                  getIO().emit("campaign_progress", {
                    campaignId: updatedCampaign._id,
                    sentCount: updatedCampaign.sentCount,
                    failedCount: updatedCampaign.failedCount,
                    status: updatedCampaign.status,
                    latestLog: {
                      phone: matchedLog.phone,
                      status: newStatus,
                      error: (status.errors && status.errors[0])
                        ? (status.errors[0].message || status.errors[0].title || "Delivery Failed")
                        : (newStatus === "failed" ? "Delivery Failed" : undefined),
                      sentAt: matchedLog.sentAt
                    },
                    whatsappAccountId: account._id
                  });
                }
              }
            }
          } catch (syncErr) {
            console.error("⚠️ Error syncing webhook status with campaign logs:", syncErr.message);
          }
        }

        // Notify UI about status update
        const io = getIO();
        io.emit("status_update", { messageId: status.id, status: status.status });

        return res.sendStatus(200);
      }

      if (message) {
        const from = normalizePhone(message.from); 

        // Reject incoming messages from blocked contacts
        const existingBlockedContact = await Contact.findOne({ phone: from, isBlocked: true });
        if (existingBlockedContact) {
          console.log(`🚫 Webhook ignored message from blocked contact: ${from}`);
          return res.sendStatus(200);
        }

        let type = message.type || "text";

        // Handle reactions separately
        if (type === "reaction") {
          const reactionInfo = message.reaction;
          if (reactionInfo && reactionInfo.message_id) {
            const targetMessageId = reactionInfo.message_id;
            const emoji = reactionInfo.emoji || null;
            const updatedMessage = await Message.findOneAndUpdate(
              { messageId: targetMessageId },
              { $set: { reaction: emoji } },
              { new: true }
            );
            if (updatedMessage) {
              console.log(`😀 Reaction updated for message ${targetMessageId}: ${emoji}`);
              getIO().emit("message_reaction", { messageId: targetMessageId, reaction: emoji });
            }
          }
          return res.sendStatus(200);
        }

        let bodyContent = "";

        let mediaUrl = null;

        if (type === "text") {
          bodyContent = message.text?.body;
        } else if (type === "button") {
          bodyContent = message.button?.text;
        } else if (type === "interactive") {
          const interactive = message.interactive;
          bodyContent = interactive?.button_reply?.title || interactive?.list_reply?.title || interactive?.button_reply?.id;
        } else if (type === "image" || type === "video" || type === "audio" || type === "document") {
          const media = message[type];
          bodyContent = media?.caption || `${type.charAt(0).toUpperCase() + type.slice(1)} received`;
          if (media?.id) {
            try {
              mediaUrl = await getMediaUrl(account, media.id);
            } catch (err) {
              console.error(`Error fetching ${type} URL:`, err);
            }
          }
        }

        // Final fallback if nothing worked
        if (!bodyContent) {
          bodyContent = `Received ${type} message`;
        }

        console.log(`📩 PROCESSED: [${type}] "${bodyContent}" from ${from}`);

        // FIX: Check if message already exists to prevent duplicate key errors from Meta retries
        const existingMsg = await Message.findOne({ messageId: message.id });
        if (existingMsg) {
          console.log(`ℹ️ Message ${message.id} already exists. Skipping save.`);
          return res.sendStatus(200);
        }

        let quotedMessageId = null;
        let quotedMessageBody = null;
        if (message.context && message.context.id) {
          quotedMessageId = message.context.id;
          const quotedMsg = await Message.findOne({ messageId: quotedMessageId });
          if (quotedMsg) {
            quotedMessageBody = quotedMsg.body;
          }
        }

        const newMessage = new Message({
          messageId: message.id,
          from,
          to: "me",
          body: bodyContent,
          type,
          mediaUrl,
          direction: "inbound",
          whatsappAccountId: account?._id,
          quotedMessageId,
          quotedMessageBody
        });
        await newMessage.save();

        // Step 1: Find or Create Contact (Always normalize phone)
        let contact = await Contact.findOne({ phone: from });
        
        // Step 2: Find existing Conversation (Checking both current account and unassigned/legacy)
        let conversation = await Conversation.findOne({ 
          phone: from, 
          $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] 
        }).sort({ lastMessageTime: -1 });
        
        // Extract Profile Name from Meta Webhook
        const profileName = value?.contacts?.[0]?.profile?.name;

        if (!contact) {
          contact = new Contact({ 
            name: profileName || `User ${from}`, 
            phone: from,
            whatsappAccountId: account?._id 
          });
        } else if (!contact.whatsappAccountId) {
          // Associate legacy contact with this account
          contact.whatsappAccountId = account?._id;
        } else if (profileName && contact.name.startsWith("User ")) {
          // Update generic name with real profile name if found
          contact.name = profileName;
        }

        // Step 3: Check dynamic Keyword Rules for automation
        const textContent = bodyContent.trim().toLowerCase();
        
        // Fetch all active rules for this account or global
        const allRules = await KeywordRule.find({ 
          active: true,
          $or: [
            { whatsappAccountIds: account._id },
            { whatsappAccountIds: { $size: 0 } },
            { whatsappAccountIds: { $exists: false } }
          ]
        });

        let matchingRule = null;
        let highestRuleScore = 0;
        let wildcardRule = null;
        let bestRuleKeywordLength = 0;

        for (const rule of allRules) {
          const keyword = rule.keyword.trim().toLowerCase();

          if (keyword === "*") {
            wildcardRule = rule;
            continue;
          }

          const currentScore = matchKeyword(textContent, keyword);

          if (currentScore > highestRuleScore || (currentScore === highestRuleScore && currentScore > 0 && keyword.length > bestRuleKeywordLength)) {
            highestRuleScore = currentScore;
            matchingRule = rule;
            bestRuleKeywordLength = keyword.length;
          }
        }
        
        let statusUpdated = false;
        if (matchingRule && highestRuleScore >= 0.8) {
          console.log(`🤖 Keyword Rule matched: "${textContent}" -> ${matchingRule.targetStatus} (Score: ${highestRuleScore})`);
          contact.status = matchingRule.targetStatus;
          contact.statusUpdatedAt = new Date();
          statusUpdated = true;
          
          if (matchingRule.assignedTo) {
            contact.assignedTo = matchingRule.assignedTo;
          }
        } else if (wildcardRule) {
          console.log(`🤖 Wildcard Rule matched for any message -> ${wildcardRule.targetStatus}`);
          contact.status = wildcardRule.targetStatus;
          contact.statusUpdatedAt = new Date();
          statusUpdated = true;
          
          if (wildcardRule.assignedTo) {
            contact.assignedTo = wildcardRule.assignedTo;
          }
        } else if (textContent === "stop") {
          contact.isBlocked = true; // Prevents the Cron Job and Campaigns from messaging this number
        }

        await contact.save();

        if (!conversation) {
          conversation = new Conversation({ 
            contact: contact._id, 
            phone: from,
            whatsappAccountId: account?._id,
            status: contact.status || "New", // Sync status from contact if it's a fresh conversation record
            assignedTo: contact.assignedTo, // Carry over assignment if any
            sector: contact.sector || "Unassigned",
            subsector: contact.subsector || "Unassigned"
          });
        }
        
        // Step 4: Update the Conversation and CLAIM it for this account
        conversation.whatsappAccountId = account?._id;
        conversation.lastMessage = bodyContent;
        conversation.lastMessageTime = new Date();
        conversation.lastCustomerMessageAt = new Date();
        conversation.unreadCount += 1;
        
        // Step 5: If a keyword or wildcard rule matched, update the Conversation status and assignment too!
        if (statusUpdated) {
          conversation.status = contact.status;
          const targetAssignee = (matchingRule && matchingRule.assignedTo) || (wildcardRule && wildcardRule.assignedTo);
          if (targetAssignee) {
            conversation.assignedTo = targetAssignee;
          }
        }

        await conversation.save();

        // Populate contact before emitting
        const populatedConv = await Conversation.findById(conversation._id).populate("contact");

        // Step 6: Notify the frontend UI instantly via WebSockets to show the new message without refreshing
        smartEmit("new_message", { message: newMessage, conversation: populatedConv });

        // Step 7: TRIGGER AUTOMATION (Chatbot AutoReplies)
        // Checks if the user's message matches any keyword rules created in the AutoReply UI.
        if (type === "text" || type === "interactive" || type === "button") {
          processAutoReply(account, from, bodyContent, contact);
        }
      }
      res.sendStatus(200);
    } catch (err) {
      console.error("❌ CRITICAL WEBHOOK ERROR:", err);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(404);
  }
};
