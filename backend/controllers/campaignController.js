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

const processCampaignExecution = async (campaign, account, contacts, template, templateComponents, delay, req) => {
  if (!template) {
    console.error(`❌ Campaign Execution Error: Template missing for campaign "${campaign.name}"`);
    return;
  }
  const initialSent = campaign.sentCount || 0;
  const initialFailed = campaign.failedCount || 0;
  const initialLogs = campaign.logs || [];

  throttleCampaign(
    account,
    contacts,
    template.name,
    sendTemplateMessage,
    async (currentSuccess, currentFailure, currentLogs, latestLog) => {
      if (latestLog && latestLog.status === "sent") {
        let messageBody = `Campaign [${campaign.name}]: ${template.name}`;
        
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

        let contact = await Contact.findOne({ phone: latestLog.phone, whatsappAccountId: account._id });
        if (!contact) {
          contact = new Contact({ 
            name: `User ${latestLog.phone}`, 
            phone: latestLog.phone, 
            whatsappAccountId: account._id,
            sourceCampaign: campaign.name,
            sector: "Unassigned"
          });
          await contact.save();
        } else {
          if (!contact.sourceCampaign) contact.sourceCampaign = campaign.name;
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
          messageId: latestLog.messageId,
          from: "me",
          to: latestLog.phone,
          body: messageBody,
          type: "template",
          whatsappAccountId: account._id,
          templateData: { name: template.name, components: templateComponents },
          mediaUrl: mediaUrl,
          direction: "outbound",
          status: "sent"
        });
        await newMessage.save();

        const normalizedPhone = latestLog.phone.toString().replace(/\D/g, "");
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

      const totalSent = initialSent + currentSuccess;
      const totalFailed = initialFailed + currentFailure;
      const allLogs = [...initialLogs, ...currentLogs];
      const isFinished = (totalSent + totalFailed) >= campaign.totalContacts;
      const currentStatus = isFinished ? "COMPLETED" : "RUNNING";

      await Campaign.findByIdAndUpdate(campaign._id, {
        sentCount: totalSent,
        failedCount: totalFailed,
        logs: allLogs,
        status: currentStatus
      });

      const io = getIO();
      io.emit("campaign_progress", {
        campaignId: campaign._id,
        sentCount: totalSent,
        failedCount: totalFailed,
        status: currentStatus,
        logs: allLogs,
        whatsappAccountId: account._id
      });
    },
    templateComponents || [],
    template.language || "en_US",
    delay,
    campaign._id
  );
};

export const startCampaign = async (req, res) => {
  try {
    let { name, templateName, contacts, templateComponents, whatsappAccountId, delay, sector } = req.body;
    
    let account = whatsappAccountId ? await WhatsAppAccount.findById(whatsappAccountId) : req.whatsappAccount;
    if (!account) return res.status(400).json({ error: "No valid WhatsApp account found" });

    const uniquePhones = [...new Set(contacts.map(c => normalizePhone(typeof c === 'object' ? c.phone : c)))];
    const blockedContacts = await Contact.find({ phone: { $in: uniquePhones }, isBlocked: true }, 'phone');
    const blockedPhones = new Set(blockedContacts.map(c => c.phone));
    const allowedPhones = uniquePhones.filter(phone => !blockedPhones.has(phone));
    
    if (allowedPhones.length === 0) return res.status(400).json({ error: "All contacts are blocked or invalid." });

    const template = await Template.findOne({ name: templateName, whatsappAccountId: account._id });
    if (!template) return res.status(404).json({ error: "Template not found" });

    const campaign = new Campaign({
      name,
      template: template._id,
      whatsappAccountId: account._id,
      totalContacts: allowedPhones.length,
      status: "RUNNING"
    });
    await campaign.save();

    await logActivity(req.user._id, "START_CAMPAIGN", `Started campaign with ${allowedPhones.length} contacts`, name);

    processCampaignExecution(campaign, account, allowedPhones.map(p => ({ phone: p })), template, templateComponents, delay, req);

    res.status(202).json({ message: "Campaign started", campaignId: campaign._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, allowOutsideHours } = req.body;
    
    const update = {};
    if (status) update.status = status;
    if (allowOutsideHours !== undefined) update.allowOutsideHours = allowOutsideHours;

    const campaign = await Campaign.findByIdAndUpdate(id, update, { new: true });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // If resuming, we don't necessarily need to start a new throttler because 
    // the existing one might be waiting in its loop.
    // However, if the throttler finished (e.g. server restart), we might need to restart it.
    // For now, our throttler loop handles status changes.

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const retryFailedContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id).populate("template");
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    if (!campaign.template) {
      return res.status(404).json({ error: "The template used for this campaign no longer exists." });
    }

    // Find failed contacts from logs
    const failedLogs = campaign.logs.filter(l => l.status === "failed");
    if (failedLogs.length === 0) return res.status(400).json({ error: "No failed contacts to retry" });

    // Filter out duplicates if multiple retries happened
    const failedPhones = [...new Set(failedLogs.map(l => l.phone))];
    
    // We update status to RUNNING
    campaign.status = "RUNNING";
    await campaign.save();

    const account = await WhatsAppAccount.findById(campaign.whatsappAccountId);
    
    // We need templateComponents. They are stored in Message models but not in Campaign.
    // For a retry, we'll try to find the last template components from a previous message in this campaign.
    const lastMsg = await Message.findOne({ to: { $in: failedPhones }, whatsappAccountId: account._id }).sort({ createdAt: -1 });
    const templateComponents = lastMsg?.templateData?.components || [];

    processCampaignExecution(campaign, account, failedPhones.map(p => ({ phone: p })), campaign.template, templateComponents, 2, req);

    res.json({ message: "Retrying failed contacts", count: failedPhones.length });
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
