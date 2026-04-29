import Campaign from "../models/Campaign.js";
import Template from "../models/Template.js";
import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import { throttleCampaign } from "../utils/messageThrottler.js";
import { sendTemplateMessage } from "../services/whatsappService.js";
import { logActivity } from "../utils/activityLogger.js";
import { normalizePhone } from "../utils/phoneUtils.js";
import { getIO, smartEmit } from "../utils/socket.js";

export const startCampaign = async (req, res) => {
  try {
    let { name, templateName, contacts, templateComponents, whatsappAccountId, delay, sector } = req.body;
    
    // 1. Identify Account
    let account = null;
    if (whatsappAccountId) {
      account = await WhatsAppAccount.findById(whatsappAccountId);
    }
    
    // Fallback to active account from middleware or default
    if (!account) {
      account = req.whatsappAccount;
    }

    if (!account) return res.status(400).json({ error: "No valid WhatsApp account found for this campaign" });

    // 2. Normalize and De-duplicate contacts
    const rawPhones = contacts.map(c => typeof c === 'object' ? c.phone : c);
    const uniquePhones = [...new Set(rawPhones.map(phone => normalizePhone(phone)))];
    
    // 3. Filter out blocked contacts
    const blockedContacts = await Contact.find({ phone: { $in: uniquePhones }, isBlocked: true }, 'phone');
    const blockedPhones = new Set(blockedContacts.map(c => c.phone));
    const allowedPhones = uniquePhones.filter(phone => !blockedPhones.has(phone));
    
    console.log(`🚀 Campaign "${name}": Cleaning duplicates and blocked. Original: ${contacts.length} -> Unique: ${uniquePhones.length} -> Allowed: ${allowedPhones.length}. Using Account: ${account.name}`);
    
    contacts = allowedPhones.map(phone => ({ phone }));

    if (contacts.length === 0) {
      return res.status(400).json({ error: "All provided contacts are either blocked or invalid." });
    }

    const template = await Template.findOne({ name: templateName, whatsappAccountId: account._id });
    if (!template) return res.status(404).json({ error: "Template not found for this account" });

    const campaign = new Campaign({
      name,
      template: template._id,
      whatsappAccountId: account._id,
      totalContacts: contacts.length,
      status: "RUNNING"
    });
    await campaign.save();

    await logActivity(req.user._id, "START_CAMPAIGN", `Started campaign with ${contacts.length} contacts from ${account.name}`, name);

    // Run Throttler (Async)
    throttleCampaign(
      account,
      contacts,
      templateName,
      sendTemplateMessage,
      async (success, failure, logs, latestLog) => {
        if (latestLog && latestLog.status === "sent") {
          const log = latestLog;
          let messageBody = `Campaign [${name}]: ${templateName}`;
          
          if (template) {
            const bodyComp = template.components.find(c => c.type === "BODY");
            if (bodyComp && bodyComp.text) {
              let text = bodyComp.text;
              if (templateComponents) {
                const bodyParams = templateComponents.find(c => c.type === "body")?.parameters || [];
                bodyParams.forEach((p, idx) => {
                  text = text.replace(`{{${idx + 1}}}`, p.text || "");
                });
              }
              messageBody = text;
            }
          }

          let contact = await Contact.findOne({ phone: log.phone, whatsappAccountId: account._id });
          if (!contact) {
            contact = new Contact({ 
              name: `User ${log.phone}`, 
              phone: log.phone, 
              whatsappAccountId: account._id,
              sourceCampaign: name,
              sector: sector || "Unassigned" // Set sector from campaign
            });
            await contact.save();
          } else {
            // Update if not already set or override if sector provided
            if (!contact.sourceCampaign) contact.sourceCampaign = name;
            if (sector) contact.sector = sector;
            await contact.save();
          }

          let mediaUrl = null;
          if (templateComponents) {
            const headerComp = templateComponents.find(c => c.type === "header");
            if (headerComp && headerComp.parameters) {
              const imgParam = headerComp.parameters.find(p => p.type === "image");
              if (imgParam) mediaUrl = imgParam.image?.link;
            }
          }

          const newMessage = new Message({
            messageId: log.messageId,
            from: "me",
            to: log.phone,
            body: messageBody,
            type: "template",
            whatsappAccountId: account._id, // Multi-account support for messages
            templateData: { name: templateName, components: templateComponents },
            mediaUrl: mediaUrl,
            direction: "outbound",
            status: "sent"
          });
          await newMessage.save();

          const normalizedPhone = log.phone.toString().replace(/\D/g, "");

          const updatedConv = await Conversation.findOneAndUpdate(
            { phone: normalizedPhone, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
            { 
              contact: contact._id,
              whatsappAccountId: account._id,
              lastMessage: newMessage.body, 
              lastMessageTime: new Date(),
              unreadCount: 0
            },
            { upsert: true, new: true }
          ).populate("contact");

          smartEmit("new_message", { message: newMessage, conversation: updatedConv, whatsappAccountId: account._id });
        }
        
        const currentStatus = (success + failure === contacts.length) ? "COMPLETED" : "RUNNING";
        
        await Campaign.findByIdAndUpdate(campaign._id, {
          sentCount: success,
          failedCount: failure,
          logs: logs,
          status: currentStatus
        });

        const io = getIO();
        io.emit("campaign_progress", {
          campaignId: campaign._id,
          sentCount: success,
          failedCount: failure,
          status: currentStatus,
          logs: logs,
          whatsappAccountId: account._id
        });
      },
      templateComponents || [],
      template.language || "en_US",
      delay
    );

    res.status(202).json({ message: "Campaign started", campaignId: campaign._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllCampaigns = async (req, res) => {
  try {
    const account = req.whatsappAccount;
    const filter = account ? { whatsappAccountId: account._id } : {};
    
    const campaigns = await Campaign.find(filter).populate("template").sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
