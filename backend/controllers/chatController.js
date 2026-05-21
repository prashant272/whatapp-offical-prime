import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Template from "../models/Template.js";
import Message from "../models/Message.js";
import Contact from "../models/Contact.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import { sendTextMessage, sendTemplateMessage, sendImageMessage, sendDocumentMessage } from "../services/whatsappService.js";
import { logActivity } from "../utils/activityLogger.js";
import { normalizePhone } from "../utils/phoneUtils.js";
import { getIO, smartEmit } from "../utils/socket.js";

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getPhoneCandidates = (phone) => {
  const clean = String(phone || "").replace(/[^0-9]/g, "");
  const candidates = new Set([String(phone || ""), clean]);
  if (clean.length === 10) candidates.add(`91${clean}`);
  if (clean.length === 12 && clean.startsWith("91")) candidates.add(clean.slice(2));
  return Array.from(candidates).filter(Boolean);
};

export const getConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, assignedTo, sector, cursor, search, filter: typeFilter } = req.query;
    const account = req.whatsappAccount;
    const accountIds = req.whatsappAccountIds;

    let filter = {};
    const conditions = [];

    // 1. Account Filtering logic
    const isExplicitAccountFilter = req.headers["x-whatsapp-account-id"];

    if (Array.isArray(accountIds)) {
      if (req.includesDefaultAccount) {
        conditions.push({
          $or: [
            { whatsappAccountId: { $in: accountIds } },
            { whatsappAccountId: { $exists: false } },
            { whatsappAccountId: null }
          ]
        });
      } else {
        conditions.push({ whatsappAccountId: { $in: accountIds } });
      }
    } else if (account?._id) {
      // For Admins/Managers, only filter if they explicitly chose an account.
      // For Executives, always restrict to their current account context.
      if (req.user.role === "Executive" || isExplicitAccountFilter) {
        conditions.push({ whatsappAccountId: account._id });
      }
    }

    // 2. Search Logic (Database-wide)
    if (search) {
      const escapedSearch = escapeRegex(search);

      const contactIds = await Contact.find({
        name: { $regex: escapedSearch, $options: "i" }
      }).distinct("_id");

      conditions.push({
        $or: [
          { phone: { $regex: escapedSearch, $options: "i" } },
          { lastMessage: { $regex: escapedSearch, $options: "i" } },
          { contact: { $in: contactIds } }
        ]
      });
    }

    // 3. Additional Filters
    if (status && status !== "all") conditions.push({ status });
    if (assignedTo && assignedTo !== "all") {
      if (assignedTo === "unassigned") {
        conditions.push({ $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] });
      } else {
        conditions.push({ assignedTo });
      }
    }
    if (sector && sector !== "all") conditions.push({ sector });

    // 3b. Unread/Window Quick Filters
    if (typeFilter === "unread") {
      conditions.push({ unreadCount: { $gt: 0 } });
    } else if (typeFilter === "window") {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      conditions.push({ lastCustomerMessageAt: { $gte: twentyFourHoursAgo } });
    }

    // 4. Role-based restriction
    if (req.user.role === "Executive") {
      // Executives ONLY see their own assigned chats
      conditions.push({ assignedTo: req.user._id });
    }

    // Apply conditions
    if (conditions.length > 0) {
      filter.$and = conditions;
    }

    if (cursor) {
      filter.lastMessageTime = { $lt: new Date(cursor) };
    }

    // Remove excessive logging

    const skip = cursor ? 0 : (parseInt(page) - 1) * parseInt(limit);
    const total = await Conversation.countDocuments(filter);
    let conversations = await Conversation.find(filter)
      .populate("contact", "_id name phone sector")
      .select("phone lastMessage lastMessageTime unreadCount status contact whatsappAccountId assignedTo sector followUpTime followUpActivity lastCustomerMessageAt")
      .sort({ lastMessageTime: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Fallback: If searching and we have room in the list, search for matching Contacts 
    // who don't have a conversation record yet in this account context
    // RBAC: Executives should NOT see unassigned contacts in search fallback
    if (search && req.user.role !== "Executive" && conversations.length < Number(limit)) {
      const existingPhones = conversations.map(c => c.phone);

      const extraContacts = await Contact.find({
        phone: { $nin: existingPhones },
        $or: [
          { phone: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } }
        ]
      }).limit(Number(limit) - conversations.length);

      const virtualConvs = extraContacts.map(contact => ({
        _id: `new:${contact.phone}`,
        contact: contact,
        phone: contact.phone,
        lastMessage: "Saved Contact (No history)",
        lastMessageTime: null,
        unreadCount: 0,
        status: "New",
        whatsappAccountId: contact.whatsappAccountId,
        isVirtual: true
      }));

      conversations = [...conversations, ...virtualConvs];
    }

    const nextCursor = (conversations.length > 0 && !conversations[conversations.length - 1].isVirtual)
      ? conversations[conversations.length - 1].lastMessageTime
      : null;

    res.json({
      conversations,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalConversations: total,
      hasMore: skip + (conversations.filter(c => !c.isVirtual).length) < total,
      nextCursor
    });
  } catch (error) {
    console.error("❌ getConversations Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { phone } = req.params;
    const account = req.whatsappAccount;
    const accountIds = req.whatsappAccountIds;

    let accountFilter = {};
    if (Array.isArray(accountIds)) {
      if (req.includesDefaultAccount) {
        accountFilter = {
          $or: [
            { whatsappAccountId: { $in: accountIds } },
            { whatsappAccountId: { $exists: false } },
            { whatsappAccountId: null }
          ]
        };
      } else {
        accountFilter = { whatsappAccountId: { $in: accountIds } };
      }
    } else {
      accountFilter = { whatsappAccountId: req.whatsappAccount?._id };
    }

    const filter = {
      $and: [
        { $or: [{ from: phone }, { to: phone }] },
        accountFilter
      ]
    };

    // RBAC Check for Executives
    if (req.user.role === "Executive") {
      const isAssigned = await Conversation.findOne({
        phone,
        assignedTo: req.user._id,
        $or: [{ whatsappAccountId: req.whatsappAccount?._id }, { whatsappAccountId: null }]
      });
      if (!isAssigned) {
        return res.status(403).json({ error: "Access denied. You are not assigned to this contact." });
      }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find(filter)
      .select("body from to timestamp status direction type mediaUrl templateData")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments(filter);

    // Update unread count only for current account context - REMOVED AUTO MARK READ
    /*
    await Conversation.findOneAndUpdate(
      { phone, whatsappAccountId: account?._id },
      { unreadCount: 0 }
    );
    */

    res.json({
      messages: messages.reverse(),
      hasMore: total > skip + messages.length
    });
  } catch (err) {
    console.error(`❌ Error in ${req.url}:`, err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
};

export const resolveConversationByPhone = async (req, res) => {
  try {
    const { phone, accountId } = req.query;
    if (!phone) return res.status(400).json({ error: "Phone is required" });

    const candidates = getPhoneCandidates(phone);
    const clean = String(phone).replace(/[^0-9]/g, "");
    const last10 = clean.slice(-10);

    const phoneConditions = [{ phone: { $in: candidates } }];
    if (last10) phoneConditions.push({ phone: { $regex: `${escapeRegex(last10)}$` } });

    const filter = { $or: phoneConditions };
    if (accountId) {
      filter.whatsappAccountId = accountId;
    }
    if (req.user.role === "Executive") {
      filter.assignedTo = req.user._id;
    }

    const conversation = await Conversation.findOne(filter)
      .populate("contact")
      .populate("assignedTo", "name")
      .sort({ lastMessageTime: -1, updatedAt: -1 });

    res.json({ conversation: conversation || null });
  } catch (error) {
    console.error("resolveConversationByPhone Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { body } = req.body;
    const to = normalizePhone(req.body.to);
    const account = req.whatsappAccount;

    if (!account) throw new Error("No active WhatsApp account found");

    const metaRes = await sendTextMessage(account, to, body);
    const messageId = metaRes.messages?.[0]?.id;

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body,
      direction: "outbound",
      whatsappAccountId: account._id
    });
    await newMessage.save();

    // Step 4: Update the Conversation in the Database
    // We look for an existing conversation for this phone.
    const existingConv = await Conversation.findOne({
      phone: to,
      $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }]
    }).sort({ lastMessageTime: -1 });

    const updateFields = {
      lastMessage: body,
      lastMessageTime: new Date(),
      whatsappAccountId: account._id,
      unreadCount: 0 // Auto-mark as read when replying
    };

    // AUTO-ASSIGN: If unassigned, assign it to the sender
    if (!existingConv || !existingConv.assignedTo) {
      updateFields.assignedTo = req.user._id;
    }

    const updatedConv = await Conversation.findOneAndUpdate(
      { phone: to, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      updateFields,
      { upsert: true, new: true }
    );

    // Step 5: Claim the Customer/Contact! 
    if (updatedConv && updatedConv.contact) {
      const contactUpdate = { whatsappAccountId: account._id };
      // Also sync assignment to contact record
      if (updateFields.assignedTo) {
        contactUpdate.assignedTo = updateFields.assignedTo;
      }
      await Contact.findByIdAndUpdate(updatedConv.contact, contactUpdate);
    }

    const populatedConv = await Conversation.findById(updatedConv._id).populate("contact");
    smartEmit("new_message", { message: newMessage, conversation: populatedConv });
    await logActivity(req.user._id, "SEND_MESSAGE", `Sent text message: ${body.substring(0, 50)}...`, to);

    res.json({ success: true, message: newMessage, conversation: populatedConv });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConversationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, status, followUpTime, followUpActivity } = req.body;
    const account = req.whatsappAccount;

    // Robust ID check: If it starts with 'new:', it's a virtual ID from search
    const isVirtualId = id && id.startsWith("new:");
    const isValidId = id && mongoose.Types.ObjectId.isValid(id);

    const query = (isValidId && !isVirtualId)
      ? { _id: id }
      : { phone, $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] };

    const conversation = await Conversation.findOneAndUpdate(
      query,
      {
        status,
        followUpTime: followUpTime || null,
        followUpActivity: followUpActivity || null,
        followUpNotified: false,
        whatsappAccountId: account?._id
      },
      { new: true, upsert: true } // Use upsert for virtual IDs to create the record
    );

    // Step 2: Update the Status in the Contact record too.
    // This is vital because the Follow-up Cron Job looks at the Contact's status and account!
    if (conversation && conversation.contact) {
      await Contact.findByIdAndUpdate(conversation.contact, {
        status: status,
        statusUpdatedAt: new Date(), // Record the exact time we changed the status (used by Cron to calculate delay)
        whatsappAccountId: account?._id // Claim the contact for this account
      });
    }

    await logActivity(req.user._id, "UPDATE_STATUS", `Updated status to ${status}`, phone);
    res.json({ success: true, conversation });
  } catch (err) {
    console.error(`❌ Error in ${req.url}:`, err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
};

export const sendChatTemplateMessage = async (req, res) => {
  try {
    const { templateName, templateComponents } = req.body;
    const to = normalizePhone(req.body.to);
    const account = req.whatsappAccount;

    if (!account) throw new Error("No active WhatsApp account found");

    const template = await Template.findOne({ name: templateName });
    const lang = template ? template.language : "en_US";

    const metaRes = await sendTemplateMessage(account, to, templateName, lang, templateComponents);
    const messageId = metaRes.messages?.[0]?.id;

    // Reconstruct body for display in chat
    let messageBody = `[Template: ${templateName}]`;
    if (template && template.components) {
      const bodyComp = template.components.find(c => c.type === "BODY");
      if (bodyComp && bodyComp.text) {
        let text = bodyComp.text;
        const bodyParams = templateComponents.find(c => c.type === "body")?.parameters || [];
        bodyParams.forEach((p, idx) => {
          text = text.replace(`{{${idx + 1}}}`, p.text || "");
        });
        messageBody = text;
      }
    }

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body: messageBody,
      type: "template",
      templateData: { name: templateName, components: templateComponents },
      direction: "outbound",
      whatsappAccountId: account._id,
      status: messageId ? "sent" : "failed"
    });
    await newMessage.save();

    const existingConv = await Conversation.findOne({
      phone: to,
      $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }]
    });

    const updateFields = {
      lastMessage: newMessage.body,
      lastMessageTime: new Date(),
      whatsappAccountId: account._id,
      unreadCount: 0 // Auto-mark read on template reply
    };

    if (!existingConv || !existingConv.assignedTo) {
      updateFields.assignedTo = req.user._id;
    }

    const updatedConv = await Conversation.findOneAndUpdate(
      { phone: to, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      updateFields,
      { upsert: true, new: true }
    );

    const populatedConv = await Conversation.findById(updatedConv._id).populate("contact");
    smartEmit("new_message", { message: newMessage, conversation: populatedConv });
    await logActivity(req.user._id, "SEND_TEMPLATE", `Sent template: ${templateName}`, to);

    res.json({ success: true, message: newMessage, conversation: populatedConv });
  } catch (err) {
    console.error(`❌ Error in ${req.url}:`, err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
};

export const sendChatImageMessage = async (req, res) => {
  try {
    const { imageUrl, caption, type: providedType, filename } = req.body;
    const to = normalizePhone(req.body.to);
    const account = req.whatsappAccount;

    if (!account) throw new Error("No active WhatsApp account found");

    // Detect if it's a document based on URL or provided type
    const isDocument = providedType === "document" || 
                       imageUrl.toLowerCase().endsWith(".pdf") || 
                       imageUrl.toLowerCase().endsWith(".doc") || 
                       imageUrl.toLowerCase().endsWith(".docx") ||
                       imageUrl.toLowerCase().endsWith(".xlsx") ||
                       imageUrl.toLowerCase().endsWith(".xls");

    let metaRes;
    let type = "image";
    let bodyText = caption || "Image sent";
    let lastMsgIcon = "📷 Image";

    if (isDocument) {
      metaRes = await sendDocumentMessage(account, to, imageUrl, filename || "document.pdf", caption);
      type = "document";
      bodyText = filename || caption || "Document sent";
      lastMsgIcon = "📄 Document";
    } else {
      metaRes = await sendImageMessage(account, to, imageUrl, caption);
    }

    const messageId = metaRes.messages?.[0]?.id;

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body: bodyText,
      type,
      mediaUrl: imageUrl,
      direction: "outbound",
      status: messageId ? "sent" : "failed",
      whatsappAccountId: account._id
    });
    await newMessage.save();

    const existingConv = await Conversation.findOne({
      phone: to,
      $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }]
    });

    const updateFields = {
      lastMessage: caption || lastMsgIcon,
      lastMessageTime: new Date(),
      whatsappAccountId: account._id,
      unreadCount: 0 // Auto-mark read on media reply
    };

    if (!existingConv || !existingConv.assignedTo) {
      updateFields.assignedTo = req.user._id;
    }

    const updatedConv = await Conversation.findOneAndUpdate(
      { phone: to, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      updateFields,
      { upsert: true, new: true }
    );

    const populatedConv = await Conversation.findById(updatedConv._id).populate("contact");
    smartEmit("new_message", { message: newMessage, conversation: populatedConv });
    await logActivity(req.user._id, isDocument ? "SEND_DOCUMENT" : "SEND_IMAGE", `Sent ${type}: ${imageUrl}`, to);

    res.json({ success: true, message: newMessage, conversation: populatedConv });
  } catch (err) {
    console.error(`❌ Error in sendChatMedia:`, err);
    res.status(500).json({ error: err.message });
  }
};

export const assignConversation = async (req, res) => {
  try {
    const { phone, userId, sector } = req.body;
    const account = req.whatsappAccount;

    const updateData = {};
    if (userId !== undefined) updateData.assignedTo = userId || null;
    if (sector !== undefined) updateData.sector = sector || "Unassigned";

    const conversation = await Conversation.findOneAndUpdate(
      { phone, $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] },
      updateData,
      { new: true }
    ).populate("assignedTo", "name");

    // SYNC: Update the master Contact record as well
    if (conversation && conversation.contact) {
      const contactUpdate = {};
      if (userId !== undefined) contactUpdate.assignedTo = userId || null;
      if (sector !== undefined) contactUpdate.sector = sector || "Unassigned";

      await Contact.findByIdAndUpdate(conversation.contact, contactUpdate);
    }

    const assignedName = conversation.assignedTo ? conversation.assignedTo.name : "Unassigned";
    const sectorName = conversation.sector || "Unassigned";
    await logActivity(req.user._id, "ASSIGN_CHAT", `Assigned chat to ${assignedName} (Sector: ${sectorName})`, phone);

    const populatedConv = await Conversation.findById(conversation._id).populate("assignedTo", "name").populate("contact");
    smartEmit("chat_assigned", { conversation: populatedConv });

    res.json({ message: "Conversation assigned", conversation: populatedConv });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).populate("contact").populate("assignedTo", "name");
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // RBAC: Executives can only see their own assigned chats
    if (req.user.role === "Executive" && String(conversation.assignedTo?._id || conversation.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ error: "Access denied. This chat is not assigned to you." });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { phone } = req.body;
    const account = req.whatsappAccount;
    await Conversation.findOneAndUpdate(
      { phone, $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] },
      { unreadCount: 0 }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
