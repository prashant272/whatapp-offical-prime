import Campaign from "../models/Campaign.js";
import Template from "../models/Template.js";
import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import { throttleCampaign } from "../utils/messageThrottler.js";
import { sendTemplateMessage } from "../services/whatsappService.js";
import { initiateWhatsAppCall } from "../services/callingService.js";
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
      campaign.type === "VOICE" ? "VOICE_CALL" : template.name,
      campaign.type === "VOICE" 
        ? (acc, phone) => initiateWhatsAppCall(acc, phone, "audio")
        : sendTemplateMessage,
      async (currentSuccess, currentFailure, currentLogs, latestLog) => {
        let actualDeltaSuccess = currentSuccess - lastReportedSuccess;
        let actualDeltaFailure = currentFailure - lastReportedFailure;
        
        // Use atomic increments to avoid race conditions with webhooks
        // And use $push with $each to append ONLY the NEW logs since the last update
        const previousTotal = lastReportedSuccess + lastReportedFailure;
        const newLogsSinceLastReport = currentLogs.slice(previousTotal);
        
        lastReportedSuccess = currentSuccess;
        lastReportedFailure = currentFailure;

        if (latestLog) {
          let contactObj = null;

          // Check if there is already a message in the DB (upserted by webhook)
          if (latestLog.messageId) {
            try {
              const existingMsgDb = await Message.findOne({ messageId: latestLog.messageId });
              if (existingMsgDb) {
                latestLog.status = existingMsgDb.status;
                if (existingMsgDb.error) {
                  latestLog.error = existingMsgDb.error;
                }
              }
            } catch (dbErr) {
              console.error("⚠️ Error checking existing message for campaign status sync:", dbErr.message);
            }
          }

          // Adjust counts if the webhook already failed this message
          if (latestLog.status === "failed" && actualDeltaSuccess > 0) {
            actualDeltaFailure = actualDeltaFailure + actualDeltaSuccess;
            actualDeltaSuccess = 0;
          }

          const SUCCESS_STATUSES = ["sent", "delivered", "read"];
          const isSent = SUCCESS_STATUSES.includes(latestLog.status);
          const isFailed = latestLog.status === "failed";

          if (isSent || isFailed) {
            const logPhone = latestLog.phone;
            const stripped = logPhone.replace(/^91/, "");
            const withCode = logPhone.startsWith("91") ? logPhone : `91${logPhone}`;

             // Try to find contact with any of the formats globally (prevent duplicate creations)
            contactObj = await Contact.findOne({ 
              phone: { $in: [logPhone, stripped, withCode] }
            });

            if (!contactObj) {
              contactObj = new Contact({ 
                name: `User ${logPhone}`, 
                phone: logPhone, 
                whatsappAccountId: account._id,
                sourceCampaign: campaign.name,
                sector: sectorName || "Unassigned",
                isCampaignSent: isSent,
                isCampaignFailed: isFailed,
                status: isSent ? "sent" : (isFailed ? "failed" : null),
                accountsData: [{
                  whatsappAccountId: account._id,
                  sourceCampaign: campaign.name,
                  isCampaignSent: isSent,
                  isCampaignFailed: isFailed,
                  status: isSent ? "sent" : (isFailed ? "failed" : null),
                  statusUpdatedAt: new Date()
                }]
              });
              await contactObj.save();
            } else {
              // Contact already exists globally. Find or create account-specific details entry in accountsData.
              if (!contactObj.accountsData) contactObj.accountsData = [];
              
              let accEntry = contactObj.accountsData.find(a => a.whatsappAccountId?.toString() === account._id.toString());
              if (!accEntry) {
                accEntry = {
                  whatsappAccountId: account._id,
                  sourceCampaign: campaign.name,
                  isCampaignSent: isSent,
                  isCampaignFailed: isFailed,
                  status: isSent ? "sent" : (isFailed ? "failed" : null),
                  statusUpdatedAt: new Date()
                };
                contactObj.accountsData.push(accEntry);
              } else {
                accEntry.isCampaignSent = isSent;
                accEntry.isCampaignFailed = isFailed;
                accEntry.status = isSent ? "sent" : (isFailed ? "failed" : null);
                if (!accEntry.sourceCampaign) accEntry.sourceCampaign = campaign.name;
                accEntry.statusUpdatedAt = new Date();
              }

              // ALWAYS update top-level status/campaign fallbacks as well for backwards compatibility
              contactObj.isCampaignSent = isSent;
              contactObj.isCampaignFailed = isFailed;
              if (!contactObj.sourceCampaign) contactObj.sourceCampaign = campaign.name;
              if (sectorName && contactObj.sector !== sectorName) contactObj.sector = sectorName;
              contactObj.whatsappAccountId = account._id;
              
              await contactObj.save();
            }
          }

          if ((isSent || isFailed) && latestLog.messageId) {
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

            let mediaUrl = null;
            if (templateComponents) {
              const headerComp = templateComponents.find(c => c.type === "header");
              if (headerComp && headerComp.parameters) {
                const imgParam = headerComp.parameters.find(p => p.type === "image");
                if (imgParam) mediaUrl = imgParam.image?.link;
              }
            }

            const messageData = {
              from: "me",
              to: latestLog.phone,
              body: messageBody,
              type: "template",
              whatsappAccountId: account._id,
              campaignId: campaign._id,
              templateData: { name: template.name, components: templateComponents },
              mediaUrl: mediaUrl,
              direction: "outbound"
            };

            const updatedMsg = await Message.findOneAndUpdate(
              { messageId: latestLog.messageId },
              {
                $setOnInsert: { status: isSent ? "sent" : "failed" },
                $set: messageData
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            const normalizedPhone = latestLog.phone.toString().replace(/\D/g, "");
            const convFilter = { phone: normalizedPhone };
            if (account._id.toString() !== "all") {
              convFilter.$or = [{ whatsappAccountId: account._id }, { whatsappAccountId: null }];
            }

            const updatedConv = await Conversation.findOneAndUpdate(
              convFilter,
              { 
                contact: contactObj?._id || null,
                whatsappAccountId: account._id,
                lastMessage: updatedMsg.body, 
                lastMessageTime: new Date(),
                unreadCount: 0
              },
              { upsert: true, new: true }
            ).populate("contact");

            smartEmit("new_message", { message: updatedMsg, conversation: updatedConv, whatsappAccountId: account._id });
          }
        } // end if (latestLog)

        const totalSentCount = initialSent + currentSuccess;
        const totalFailedCount = initialFailed + currentFailure;
        const isFinished = (totalSentCount + totalFailedCount) >= campaign.totalContacts;
        
        const updateOps = {
          $inc: { 
            sentCount: actualDeltaSuccess, 
            failedCount: actualDeltaFailure 
          },
          $set: {
            ...(isFinished ? { status: "COMPLETED", completedAt: new Date() } : {})
          }
        };

        if (newLogsSinceLastReport.length > 0) {
          updateOps.$push = { logs: { $each: newLogsSinceLastReport } };
        }

        // If it's not finished, only set status to RUNNING if it's not already PAUSED or COMPLETED
        if (!isFinished) {
          const currentCampaignInDb = await Campaign.findById(campaign._id);
          if (currentCampaignInDb && !["PAUSED", "COMPLETED", "FAILED"].includes(currentCampaignInDb.status)) {
            updateOps.$set.status = "RUNNING";
          }
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
          latestLog: latestLog,
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
    
    const excludeStatuses = ["stop messege", "stop message", "bad lead"];
    const blockedContacts = await Contact.find({ 
      phone: { $in: uniquePhones }, 
      $or: [
        { isBlocked: true },
        { status: { $regex: new RegExp(`^(${excludeStatuses.join('|')})$`, 'i') } }
      ]
    }, 'phone status isBlocked');
    
    const blockedPhones = new Set(blockedContacts.map(c => c.phone));
    const allowedPhones = uniquePhones.filter(phone => !blockedPhones.has(phone));
    
    const blockedLogs = blockedContacts.map(c => {
      let reason = "Blocked";
      if (c.status && excludeStatuses.includes(c.status.toLowerCase())) {
         reason = `Skipped: ${c.status}`;
      } else if (c.isBlocked) {
         reason = "Opted-out/Blocked";
      }
      return {
        phone: c.phone,
        status: "failed",
        error: reason,
        sentAt: new Date()
      };
    });

    if (allowedPhones.length === 0 && blockedLogs.length === 0) return res.status(400).json({ error: "All contacts are invalid." });

    const template = await Template.findOne({ name: templateName, whatsappAccountId: account._id });
    if (!template) return res.status(404).json({ error: "Template not found" });

    const campaign = new Campaign({
      name,
      template: template._id,
      totalContacts: uniquePhones.length,
      contacts: allowedPhones.map(p => ({ phone: p })),
      templateComponents,
      whatsappAccountId: account._id,
      status: allowedPhones.length === 0 ? "COMPLETED" : "RUNNING",
      startedAt: new Date(),
      failedCount: blockedLogs.length,
      logs: blockedLogs
    });
    if (allowedPhones.length === 0) {
      campaign.completedAt = new Date();
    }
    await campaign.save();

    await logActivity(req.user._id, "START_CAMPAIGN", `Started campaign with ${uniquePhones.length} contacts and sector ${sector || 'None'}`, name);

    if (allowedPhones.length > 0) {
      processCampaignExecution(campaign, account, allowedPhones.map(p => ({ phone: p })), template, templateComponents, delay, req, sector);
    }

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
    
    // EXCLUDE heavy fields for list view
    const campaigns = await Campaign.find(filter)
      .select("-logs -contacts")
      .populate("template")
      .populate("whatsappAccountId", "name")
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id)
      .select("-contacts") // Exclude heavy contacts list to make loading logs instant
      .populate("template")
      .populate("whatsappAccountId", "name");
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
