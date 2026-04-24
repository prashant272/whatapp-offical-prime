import Campaign from "../models/Campaign.js";
import Template from "../models/Template.js";
import Contact from "../models/Contact.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { throttleCampaign } from "../utils/messageThrottler.js";
import { sendTemplateMessage } from "../services/whatsappService.js";
import { logActivity } from "../utils/activityLogger.js";
import { normalizePhone } from "../utils/phoneUtils.js";

export const startCampaign = async (req, res) => {
  try {
    let { name, templateName, contacts, templateComponents } = req.body;
    
    // 1. Normalize and De-duplicate contacts (Handle both string and object formats)
    const rawPhones = contacts.map(c => typeof c === 'object' ? c.phone : c);
    const uniquePhones = [...new Set(rawPhones.map(phone => normalizePhone(phone)))];
    
    console.log(`🚀 Campaign "${name}": Cleaned duplicates. ${contacts.length} -> ${uniquePhones.length} unique contacts.`);
    
    // Convert back to object format expected by throttleCampaign
    contacts = uniquePhones.map(phone => ({ phone }));

    const template = await Template.findOne({ name: templateName });
    if (!template) return res.status(404).json({ error: "Template not found" });

    const campaign = new Campaign({
      name,
      template: template._id,
      totalContacts: contacts.length,
      status: "RUNNING"
    });
    await campaign.save();

    await logActivity(req.user._id, "START_CAMPAIGN", `Started campaign with ${contacts.length} contacts`, name);

    throttleCampaign(
      contacts,
      templateName,
      sendTemplateMessage,
      async (success, failure, logs) => {
        // Find the template to reconstruct message for logs
        const fullTemplate = await Template.findById(template._id);
        
        for (const log of logs) {
          if (log.status === "sent") {
            // Reconstruct a preview of the message for the chat history
            let messageBody = `Campaign [${name}]: ${templateName}`;
            if (fullTemplate) {
              const bodyComp = fullTemplate.components.find(c => c.type === "BODY");
              if (bodyComp && bodyComp.text) {
                let text = bodyComp.text;
                // Simple replacement for logs (using values from templateComponents if available)
                if (templateComponents) {
                  const bodyParams = templateComponents.find(c => c.type === "body")?.parameters || [];
                  bodyParams.forEach((p, idx) => {
                    text = text.replace(`{{${idx + 1}}}`, p.text || "");
                  });
                }
                messageBody = text;
              }
            }

            let contact = await Contact.findOne({ phone: log.phone });
            if (!contact) {
              contact = new Contact({ name: `User ${log.phone}`, phone: log.phone });
              await contact.save();
            }

            // Extract Header Image if any
            let mediaUrl = null;
            if (templateComponents) {
              const headerComp = templateComponents.find(c => c.type === "header");
              if (headerComp && headerComp.parameters) {
                const imgParam = headerComp.parameters.find(p => p.type === "image");
                if (imgParam) mediaUrl = imgParam.image?.link;
              }
            }

            const newMessage = new Message({
              from: "me",
              to: log.phone,
              body: messageBody,
              type: "template",
              templateData: {
                name: templateName,
                components: templateComponents
              },
              mediaUrl: mediaUrl,
              direction: "outbound",
              status: "sent"
            });
            await newMessage.save();

            await Conversation.findOneAndUpdate(
              { phone: log.phone },
              { 
                contact: contact._id,
                lastMessage: newMessage.body, 
                lastMessageTime: new Date() 
              },
              { upsert: true }
            );
          }
        }
        
        await Campaign.findByIdAndUpdate(campaign._id, {
          sentCount: success,
          failedCount: failure,
          logs: logs,
          status: (success + failure === contacts.length) ? "COMPLETED" : "RUNNING"
        });
      },
      templateComponents || [],
      template.language || "en_US"
    );

    res.status(202).json({ message: "Campaign started", campaignId: campaign._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find().populate("template").sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
