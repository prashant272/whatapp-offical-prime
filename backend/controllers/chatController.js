import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Template from "../models/Template.js";
import Message from "../models/Message.js";
import Contact from "../models/Contact.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import { sendTextMessage, sendTemplateMessage, sendImageMessage, sendVideoMessage, sendDocumentMessage } from "../services/whatsappService.js";
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
    const { page = 1, limit = 20, status, assignedTo, sector, source, winner, subsector, gender, cursor, search, filter: typeFilter } = req.query;
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

    // 2. Search Logic (Database-wide - Optimized for high speed)
    let isPhoneSearch = false;
    let phoneVariations = [];
    if (search) {
      const cleanDigits = search.replace(/\D/g, "");
      isPhoneSearch = cleanDigits.length >= 3 && /^[\d\s\+\-\(\)]+$/.test(search.trim());

      if (isPhoneSearch) {
        phoneVariations = [cleanDigits];
        if (cleanDigits.length === 10) {
          phoneVariations.push("91" + cleanDigits, "+91" + cleanDigits);
        } else if (cleanDigits.length === 12 && cleanDigits.startsWith("91")) {
          phoneVariations.push(cleanDigits.substring(2), "+" + cleanDigits);
        } else if (cleanDigits.length === 11 && cleanDigits.startsWith("0")) {
          phoneVariations.push(cleanDigits.substring(1), "91" + cleanDigits.substring(1));
        }

        // Fast indexed phone search
        conditions.push({
          $or: [
            { phone: { $in: phoneVariations } },
            { phone: new RegExp(cleanDigits, "i") }
          ]
        });
      } else {
        const escapedSearch = escapeRegex(search);

        const contactIds = await Contact.find({
          name: { $regex: escapedSearch, $options: "i" }
        }).select("_id").limit(100).lean();

        const contactIdList = contactIds.map(c => c._id);

        const orList = [
          { phone: { $regex: escapedSearch, $options: "i" } }
        ];

        if (contactIdList.length > 0) {
          orList.push({ contact: { $in: contactIdList } });
        }

        if (search.trim().length >= 3) {
          orList.push({ lastMessage: { $regex: escapedSearch, $options: "i" } });
        }

        conditions.push({ $or: orList });
      }
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
    if (sector && sector !== "all") {
      if (sector.toLowerCase() === "unassigned") {
        conditions.push({ $or: [{ sector: "Unassigned" }, { sector: "unassigned" }, { sector: null }, { sector: { $exists: false } }, { sector: "" }] });
      } else {
        conditions.push({ sector });
      }
    }
    if (subsector && subsector !== "all") conditions.push({ subsector });
    if (source && source !== "all") conditions.push({ source });
    if (winner && winner !== "all") conditions.push({ winners: winner });
    if (gender && gender !== "all") {
      if (gender.toLowerCase() === "unassigned") {
        conditions.push({ $or: [{ gender: "Unassigned" }, { gender: "unassigned" }, { gender: null }, { gender: { $exists: false } }, { gender: "" }] });
      } else {
        conditions.push({ gender: new RegExp(`^${gender}$`, "i") });
      }
    }

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

    const skip = cursor ? 0 : (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Number(limit);

    // Skip heavy countDocuments on search for ultra-fast response
    const total = search ? 0 : await Conversation.countDocuments(filter);

    let conversations = await Conversation.find(filter)
      .populate("contact", "_id name phone sector subsector gender assignedTo")
      .populate("assignedTo", "name")
      .select("phone lastMessage lastMessageTime unreadCount status contact whatsappAccountId assignedTo sector subsector gender followUpTime followUpActivity lastCustomerMessageAt")
      .sort({ lastMessageTime: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    for (const c of conversations) {
      if (!c.assignedTo && c.contact?.assignedTo) {
        c.assignedTo = c.contact.assignedTo;
      }
    }

    // Fallback: If searching and we have room in the list, search for matching Contacts
    // who don't have a conversation record yet in this account context
    // RBAC: Executives should NOT see unassigned contacts in search fallback
    if (search && req.user.role !== "Executive" && conversations.length < limitNum) {
      const existingPhones = conversations.map(c => c.phone);

      let contactQuery = { phone: { $nin: existingPhones } };
      if (isPhoneSearch) {
        contactQuery.$or = [
          { phone: { $in: phoneVariations } },
          { phone: new RegExp(search.replace(/\D/g, ""), "i") }
        ];
      } else {
        const escaped = escapeRegex(search);
        contactQuery.$or = [
          { phone: { $regex: escaped, $options: "i" } },
          { name: { $regex: escaped, $options: "i" } }
        ];
      }

      const extraContacts = await Contact.find(contactQuery)
        .select("_id name phone sector subsector gender whatsappAccountId assignedTo")
        .populate("assignedTo", "name")
        .limit(limitNum - conversations.length)
        .lean();

      const virtualConvs = extraContacts.map(contact => ({
        _id: `new:${contact.phone}`,
        contact: contact,
        phone: contact.phone,
        lastMessage: "Saved Contact (No history)",
        lastMessageTime: null,
        unreadCount: 0,
        status: "New",
        sector: contact.sector || "Unassigned",
        subsector: contact.subsector || "Unassigned",
        gender: contact.gender || "Unassigned",
        whatsappAccountId: contact.whatsappAccountId,
        assignedTo: contact.assignedTo,
        isVirtual: true
      }));

      conversations = [...conversations, ...virtualConvs];
    }

    const nextCursor = (conversations.length > 0 && !conversations[conversations.length - 1].isVirtual)
      ? conversations[conversations.length - 1].lastMessageTime
      : null;

    const hasMore = search
      ? conversations.filter(c => !c.isVirtual).length === limitNum
      : (skip + conversations.filter(c => !c.isVirtual).length < total);

    res.json({
      conversations,
      currentPage: Number(page),
      totalPages: search ? 1 : Math.ceil(total / limitNum),
      totalConversations: search ? conversations.length : total,
      hasMore,
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
      .select("messageId body from to timestamp status direction type mediaUrl templateData reaction quotedMessageId quotedMessageBody whatsappAccountId")
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

    let conversation = await Conversation.findOne(filter)
      .populate("contact")
      .populate("assignedTo", "name")
      .sort({ lastMessageTime: -1, updatedAt: -1 });

    if (!conversation) {
      // Look for a Contact if Conversation doesn't exist
      const contactCondition = [{ phone: { $in: candidates } }];
      if (last10) contactCondition.push({ phone: { $regex: `${escapeRegex(last10)}$` } });
      const contact = await Contact.findOne({ $or: contactCondition }).sort({ createdAt: -1 });

      if (contact) {
        // Create an empty conversation so custom fields become active
        conversation = new Conversation({
          phone: contact.phone,
          contact: contact._id,
          whatsappAccountId: accountId || undefined,
          assignedTo: req.user.role === "Executive" ? req.user._id : undefined,
          status: "New",
          messages: [],
          lastMessageTime: new Date()
        });
        await conversation.save();
        conversation = await conversation.populate("contact");
        if (conversation.assignedTo) {
          conversation = await conversation.populate("assignedTo", "name");
        }
      }
    }

    res.json({ conversation: conversation || null });
  } catch (error) {
    console.error("resolveConversationByPhone Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { body, quotedMessageId } = req.body;
    const to = normalizePhone(req.body.to);
    const account = req.whatsappAccount;

    if (!account) throw new Error("No active WhatsApp account found");

    let contact = await Contact.findOne({ phone: to });
    if (contact && contact.isBlocked) {
      return res.status(400).json({ error: "Cannot send messages to a blocked contact." });
    }

    console.log(`📤 sendMessage controller called: body="${body}", to="${to}", quotedMessageId="${quotedMessageId}"`);
    const metaRes = await sendTextMessage(account, to, body, quotedMessageId);
    console.log("📤 Meta API Response:", JSON.stringify(metaRes));
    const messageId = metaRes.messages?.[0]?.id;

    let quotedMessageBody = null;
    if (quotedMessageId) {
      const quotedMsg = await Message.findOne({ messageId: quotedMessageId });
      if (quotedMsg) {
        quotedMessageBody = quotedMsg.body;
      }
    }

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body,
      direction: "outbound",
      whatsappAccountId: account._id,
      quotedMessageId,
      quotedMessageBody
    });
    await newMessage.save();

    contact = await Contact.findOne({ phone: to });
    if (!contact) {
      contact = new Contact({
        phone: to,
        name: "Unknown",
        whatsappAccountId: account._id,
        assignedTo: req.user._id,
        source: "Manual Chat",
        sector: "Unassigned"
      });
      await contact.save();
    }

    const updateFields = {
      lastMessage: body,
      lastMessageTime: new Date(),
      whatsappAccountId: account._id,
      unreadCount: 0,
      contact: contact._id
    };

    const existingConv = await Conversation.findOne({
      phone: to,
      $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }]
    }).sort({ lastMessageTime: -1 });

    if (!existingConv || !existingConv.assignedTo) {
      updateFields.assignedTo = req.user._id;
    }

    const updatedConv = await Conversation.findOneAndUpdate(
      { phone: to, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      updateFields,
      { upsert: true, new: true }
    );

    // Sync assigning to Contact
    const contactUpdate = {
      whatsappAccountId: account._id,
      activeFlowId: null,
      currentStepIndex: 0
    };
    if (updateFields.assignedTo) contactUpdate.assignedTo = updateFields.assignedTo;
    await Contact.findByIdAndUpdate(contact._id, contactUpdate);

    const populatedConv = await Conversation.findById(updatedConv._id).populate("contact");
    smartEmit("new_message", { message: newMessage, conversation: populatedConv });
    await logActivity(req.user._id, "SEND_MESSAGE", `Sent text message: ${body.substring(0, 50)}...`, to);

    res.json({ success: true, message: newMessage, conversation: populatedConv });
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: errorMsg });
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

    const existingConv = await Conversation.findOne(query);
    const targetUserId = existingConv?.assignedTo || req.user._id;

    if (followUpTime) {
      const followUpDate = new Date(followUpTime);
      const overlap = await Conversation.findOne({
        assignedTo: targetUserId,
        followUpTime: followUpDate,
        ...(isValidId && !isVirtualId ? { _id: { $ne: id } } : { phone: { $ne: phone } })
      });

      if (overlap) {
        return res.status(400).json({ 
          error: `The assigned specialist already has a follow-up scheduled for exactly this time with contact ${overlap.phone || 'another contact'}. Please choose a different time.` 
        });
      }
    }

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
    ).populate("contact").populate("assignedTo", "name");

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

    let contact = await Contact.findOne({ phone: to });
    if (contact && contact.isBlocked) {
      return res.status(400).json({ error: "Cannot send messages to a blocked contact." });
    }

    const template = await Template.findOne({ name: templateName, whatsappAccountId: account._id });
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


    if (!contact) {
      contact = new Contact({
        phone: to,
        name: "Unknown",
        whatsappAccountId: account._id,
        assignedTo: req.user._id,
        source: "Manual Chat",
        sector: "Unassigned"
      });
      await contact.save();
    }

    const updateFields = {
      lastMessage: newMessage.body,
      lastMessageTime: new Date(),
      whatsappAccountId: account._id,
      unreadCount: 0,
      contact: contact._id
    };

    if (!existingConv || !existingConv.assignedTo) {
      updateFields.assignedTo = req.user._id;
    }

    const updatedConv = await Conversation.findOneAndUpdate(
      { phone: to, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      updateFields,
      { upsert: true, new: true }
    );

    await Contact.findByIdAndUpdate(contact._id, {
      isCampaignSent: true,
      whatsappAccountId: account._id
    });

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

    let contact = await Contact.findOne({ phone: to });
    if (contact && contact.isBlocked) {
      return res.status(400).json({ error: "Cannot send messages to a blocked contact." });
    }

    const isDocument = providedType === "document" ||
      imageUrl.toLowerCase().endsWith(".pdf") ||
      imageUrl.toLowerCase().endsWith(".doc") ||
      imageUrl.toLowerCase().endsWith(".docx") ||
      imageUrl.toLowerCase().endsWith(".xlsx") ||
      imageUrl.toLowerCase().endsWith(".xls");

    const isVideo = providedType === "video" ||
      imageUrl.toLowerCase().endsWith(".mp4") ||
      imageUrl.toLowerCase().endsWith(".webm") ||
      imageUrl.toLowerCase().endsWith(".ogg");

    let metaRes;
    let type = "image";
    let bodyText = caption || "Image sent";
    let lastMsgIcon = "📷 Image";

    if (isDocument) {
      metaRes = await sendDocumentMessage(account, to, imageUrl, filename || "document.pdf", caption);
      type = "document";
      bodyText = filename || caption || "Document sent";
      lastMsgIcon = "📄 Document";
    } else if (isVideo) {
      metaRes = await sendVideoMessage(account, to, imageUrl, caption);
      type = "video";
      bodyText = caption || "Video sent";
      lastMsgIcon = "🎥 Video";
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


    if (!contact) {
      contact = new Contact({
        phone: to,
        name: "Unknown",
        whatsappAccountId: account._id,
        assignedTo: req.user._id,
        source: "Manual Chat",
        sector: "Unassigned"
      });
      await contact.save();
    }

    const updateFields = {
      lastMessage: caption || lastMsgIcon,
      lastMessageTime: new Date(),
      whatsappAccountId: account._id,
      unreadCount: 0,
      contact: contact._id
    };

    if (!existingConv || !existingConv.assignedTo) {
      updateFields.assignedTo = req.user._id;
    }

    const updatedConv = await Conversation.findOneAndUpdate(
      { phone: to, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      updateFields,
      { upsert: true, new: true }
    );

    const contactUpdate = {
      whatsappAccountId: account._id,
      activeFlowId: null,
      currentStepIndex: 0
    };
    if (updateFields.assignedTo) {
      contactUpdate.assignedTo = updateFields.assignedTo;
    }
    await Contact.findByIdAndUpdate(contact._id, contactUpdate);

    const populatedConv = await Conversation.findById(updatedConv._id).populate("contact");
    smartEmit("new_message", { message: newMessage, conversation: populatedConv });
    await logActivity(req.user._id, isDocument ? "SEND_DOCUMENT" : isVideo ? "SEND_VIDEO" : "SEND_IMAGE", `Sent ${type}: ${imageUrl}`, to);

    res.json({ success: true, message: newMessage, conversation: populatedConv });
  } catch (err) {
    console.error(`❌ Error in sendChatMedia:`, err);
    const metaError = err.response?.data?.error?.message || err.response?.data?.error || err.message;
    res.status(500).json({ error: metaError });
  }
};

export const assignConversation = async (req, res) => {
  try {
    const { phone, userId, sector, subsector, source, winners, gender } = req.body;
    const account = req.whatsappAccount;

    const updateData = {};
    if (userId !== undefined) updateData.assignedTo = userId || null;
    if (sector !== undefined) updateData.sector = sector || "Unassigned";
    if (subsector !== undefined) updateData.subsector = subsector || "Unassigned";
    if (source !== undefined) updateData.source = source || "Unassigned";
    if (gender !== undefined) updateData.gender = gender || "Unassigned";
    if (winners !== undefined) {
      updateData.winners = Array.isArray(winners) ? winners : (typeof winners === "string" ? winners.split(",").map(w => w.trim()).filter(Boolean) : []);
    }

    const filter = { phone };
    if (account?._id && account._id !== "all") {
      filter.$or = [{ whatsappAccountId: account._id }, { whatsappAccountId: null }];
    }

    let conversation = await Conversation.findOneAndUpdate(
      filter,
      updateData,
      { new: true }
    ).populate("assignedTo", "name");

    if (!conversation) {
      conversation = await Conversation.findOne({ phone }).populate("assignedTo", "name");
    }

    // CRITICAL: Update ALL conversations for this phone number to keep assignment and taxonomy global
    if (userId !== undefined) {
      await Conversation.updateMany({ phone }, { $set: { assignedTo: userId || null } });
    }
    if (sector !== undefined) {
      await Conversation.updateMany({ phone }, { $set: { sector: sector || "Unassigned" } });
    }
    if (subsector !== undefined) {
      await Conversation.updateMany({ phone }, { $set: { subsector: subsector || "Unassigned" } });
    }
    if (source !== undefined) {
      await Conversation.updateMany({ phone }, { $set: { source: source || "Unassigned" } });
    }
    if (winners !== undefined) {
      await Conversation.updateMany({ phone }, { $set: { winners: updateData.winners } });
    }
    if (gender !== undefined) {
      await Conversation.updateMany({ phone }, { $set: { gender: gender || "Unassigned" } });
    }

    // SYNC: Update all master Contact records for this phone number as well
    const contactUpdate = {};
    if (userId !== undefined) contactUpdate.assignedTo = userId || null;
    if (sector !== undefined) contactUpdate.sector = sector || "Unassigned";
    if (subsector !== undefined) contactUpdate.subsector = subsector || "Unassigned";
    if (source !== undefined) contactUpdate.source = source || "Unassigned";
    if (gender !== undefined) contactUpdate.gender = gender || "Unassigned";
    if (winners !== undefined) contactUpdate.winners = updateData.winners;

    if (Object.keys(contactUpdate).length > 0) {
      await Contact.updateMany({ phone }, { $set: contactUpdate });
    }

    // Ensure all conversations for this phone are linked to the master contact
    const masterContact = await Contact.findOne({ phone }).select('_id');
    if (masterContact) {
      await Conversation.updateMany(
        { phone, $or: [{ contact: null }, { contact: { $exists: false } }] },
        { $set: { contact: masterContact._id } }
      );
    }

    const assignedName = (userId !== undefined ? (userId ? "Specialist" : "Unassigned") : null) || (conversation?.assignedTo?.name || "Unassigned");
    const sectorName = conversation?.sector || "Unassigned";
    const subsectorName = conversation?.subsector || "Unassigned";
    await logActivity(req.user._id, "ASSIGN_CHAT", `Assigned chat to ${assignedName} (Sector: ${sectorName}, Subsector: ${subsectorName})`, phone);

    const populatedConv = conversation ? await Conversation.findById(conversation._id).populate("assignedTo", "name").populate("contact") : null;
    smartEmit("chat_assigned", { conversation: populatedConv, isNewAssignment: userId !== undefined });

    res.json({ message: "Conversation assigned", conversation: populatedConv });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getConversationById = async (req, res) => {
  try {
    let conversation = await Conversation.findById(req.params.id).populate("contact").populate("assignedTo", "name");
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Link contact if missing
    if (!conversation.contact) {
      const c = await Contact.findOne({ phone: conversation.phone }).lean();
      if (c) {
        await Conversation.updateOne({ _id: conversation._id }, { $set: { contact: c._id } });
        conversation.contact = c;
        if (!conversation.assignedTo && c.assignedTo) {
          await Conversation.updateOne({ _id: conversation._id }, { $set: { assignedTo: c.assignedTo } });
          conversation = await Conversation.findById(req.params.id).populate("contact").populate("assignedTo", "name");
        }
      }
    } else if (!conversation.assignedTo && conversation.contact.assignedTo) {
      // Inherit assignment from contact if conversation was unassigned
      await Conversation.updateOne({ _id: conversation._id }, { $set: { assignedTo: conversation.contact.assignedTo } });
      conversation = await Conversation.findById(req.params.id).populate("contact").populate("assignedTo", "name");
    }

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