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

// Global set to track which campaigns have active throttlers running in memory
const activeThrottlers = new Set();

const processCampaignExecution = async (campaign, account, contacts, template, templateComponents, delay, req, sectorName) => {
  if (!template) {
    console.error(`❌ Campaign Execution Error: Template missing for campaign "${campaign.name}"`);
    return;
  }

  const campaignIdStr = campaign._id.toString();
  if (activeThrottlers.has(campaignIdStr)) {
    console.log(`⚠️ Campaign "${campaign.name}" already has an active throttler. Skipping...`);
    return;
  }
  activeThrottlers.add(campaignIdStr);

  const initialSent = campaign.sentCount || 0;
  const initialFailed = campaign.failedCount || 0;
  let lastReportedSuccess = 0;
  let lastReportedFailure = 0;

  try {
    await throttleCampaign(
      account,
      contacts,
      template.name,
      sendTemplateMessage,
      async (currentSuccess, currentFailure, currentLogs, latestLog) => {
        const deltaSuccess = currentSuccess - lastReportedSuccess;
        const deltaFailure = currentFailure - lastReportedFailure;
        
        lastReportedSuccess = currentSuccess;
        lastReportedFailure = currentFailure;

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
              sector: sectorName || "Unassigned",
              isCampaignSent: true
            });
            await contact.save();
          } else {
            let needsUpdate = false;
            if (!contact.sourceCampaign) {
              contact.sourceCampaign = campaign.name;
              needsUpdate = true;
            }
            if (sectorName && contact.sector !== sectorName) {
              contact.sector = sectorName;
              needsUpdate = true;
            }
            if (!contact.isCampaignSent) {
              contact.isCampaignSent = true;
              needsUpdate = true;
            }
            if (needsUpdate) await contact.save();
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
            campaignId: campaign._id,
            templateData: { name: template.name, components: templateComponents },
            mediaUrl: mediaUrl,
            direction: "outbound",
            status: "sent"
          });
          await newMessage.save();

          const normalizedPhone = latestLog.phone.toString().replace(/\D/g, "");
          const convFilter = { phone: normalizedPhone };
          if (account._id.toString() !== "all") {
            convFilter.$or = [{ whatsappAccountId: account._id }, { whatsappAccountId: null }];
          }

          const updatedConv = await Conversation.findOneAndUpdate(
            convFilter,
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

        const initialLogs = campaign.logs || [];
        const allLogs = [...initialLogs, ...currentLogs];
        const totalSentCount = initialSent + currentSuccess;
        const totalFailedCount = initialFailed + currentFailure;
        const isFinished = (totalSentCount + totalFailedCount) >= campaign.totalContacts;
        
        // Use atomic increments to avoid race conditions with webhooks
        // IMPORTANT: We only set status to RUNNING if it's not already PAUSED
        const updateOps = {
          $inc: { 
            sentCount: deltaSuccess, 
            failedCount: deltaFailure 
          },
          $set: { 
            logs: allLogs,
            ...(isFinished ? { status: "COMPLETED", completedAt: new Date() } : {})
          }
        };

        // If it's not finished and not paused, ensure it's marked as RUNNING
        const currentCampaignInDb = await Campaign.findById(campaign._id);
        if (!isFinished && currentCampaignInDb && currentCampaignInDb.status !== "PAUSED") {
          updateOps.$set.status = "RUNNING";
        }

        const updatedCampaign = await Campaign.findByIdAndUpdate(campaign._id, updateOps, { new: true });

        const currentStatus = updatedCampaign?.status || (isFinished ? "COMPLETED" : "RUNNING");
        const finalSent = updatedCampaign?.sentCount || totalSentCount;
        const finalFailed = updatedCampaign?.failedCount || totalFailedCount;

        const io = getIO();
        io.emit("campaign_progress", {
          campaignId: campaign._id,
          sentCount: finalSent,
          failedCount: finalFailed,
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
  } finally {
    activeThrottlers.delete(campaignIdStr);
  }
};

export const startCampaign = async (req, res) => {
  try {
    let { name, templateName, contacts, templateComponents, whatsappAccountId, delay, sector } = req.body;
    
    let accountId = whatsappAccountId;
    if (!accountId || accountId === "all") {
      const primary = await WhatsAppAccount.findOne({ isDefault: true }) || await WhatsAppAccount.findOne();
      accountId = primary?._id;
    }

    let account = await WhatsAppAccount.findById(accountId);
    if (!account) return res.status(400).json({ error: "Please select a valid sender account (cannot be 'all')" });

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
      totalContacts: allowedPhones.length,
      contacts: allowedPhones.map(p => ({ phone: p })),
      templateComponents,
      whatsappAccountId: account._id,
      status: "RUNNING",
      startedAt: new Date()
    });
    await campaign.save();

    await logActivity(req.user._id, "START_CAMPAIGN", `Started campaign with ${allowedPhones.length} contacts and sector ${sector || 'None'}`, name);

    processCampaignExecution(campaign, account, allowedPhones.map(p => ({ phone: p })), template, templateComponents, delay, req, sector);

    res.status(202).json({ message: "Campaign started", campaignId: campaign._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, allowOutsideHours } = req.body;
    
    const campaign = await Campaign.findById(id).populate("template");
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    if (status) campaign.status = status;
    if (allowOutsideHours !== undefined) campaign.allowOutsideHours = allowOutsideHours;
    await campaign.save();

    // Trigger resumption if manually resumed and no active throttler is running
    if (status === "RUNNING" && !activeThrottlers.has(id.toString())) {
      const account = await WhatsAppAccount.findById(campaign.whatsappAccountId);
      
      let templateComponents = campaign.templateComponents || [];

      // FALLBACK for old campaigns: Try to recover variables from a previous message
      if (templateComponents.length === 0 || templateComponents.every(c => c.parameters && c.parameters.length === 0)) {
        console.log(`🔍 Attempting to recover parameters for campaign: ${campaign.name}`);
        const samplePhones = (campaign.logs || []).slice(0, 10).map(l => l.phone);
        const prevMsg = await Message.findOne({ 
          to: { $in: samplePhones },
          whatsappAccountId: account._id,
          type: "template",
          "templateData.name": campaign.template?.name
        }).sort({ createdAt: -1 });

        if (prevMsg && prevMsg.templateData?.components?.length > 0) {
          templateComponents = prevMsg.templateData.components;
          campaign.templateComponents = templateComponents;
          await campaign.save();
        } else {
          // Instead of empty fallback, return error so user can re-assign
          return res.status(422).json({ 
            error: "MISSING_PARAMETERS", 
            message: "This old campaign is missing variable data. Please use the 'Re-campaign' button to restart it with correct variables." 
          });
        }
      }
      
      // Find remaining contacts (not in logs)
      const attemptedPhones = new Set(campaign.logs.map(l => l.phone));
      const remainingContacts = (campaign.contacts || []).filter(c => !attemptedPhones.has(c.phone));

      if (remainingContacts.length > 0) {
        processCampaignExecution(campaign, account, remainingContacts, campaign.template, templateComponents, 2, req);
      }
    }

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // If campaign is running, we might want to warn or stop it, 
    // but the delete is final. We remove it from activeThrottlers too.
    activeThrottlers.delete(id.toString());
    
    await Campaign.findByIdAndDelete(id);
    await logActivity(req.user._id, "DELETE_CAMPAIGN", `Deleted campaign: ${campaign.name}`);
    
    res.json({ message: "Campaign deleted successfully" });
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
    let filter = {};
    
    if (account && account._id !== "all") {
      filter.whatsappAccountId = account._id;
    }
    
    const campaigns = await Campaign.find(filter)
      .populate("template")
      .populate("whatsappAccountId", "name")
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
