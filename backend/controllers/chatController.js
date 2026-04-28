import Conversation from "../models/Conversation.js";
import Template from "../models/Template.js";
import Message from "../models/Message.js";
import Contact from "../models/Contact.js";
import { sendTextMessage, sendTemplateMessage, sendImageMessage } from "../services/whatsappService.js";
import { logActivity } from "../utils/activityLogger.js";
import { normalizePhone } from "../utils/phoneUtils.js";
import { getIO, smartEmit } from "../utils/socket.js";

export const getConversations = async (req, res) => {
  try {
    const account = req.whatsappAccount;
    const accountId = account?._id;
    
    // SMART FILTER: If it's the primary/default account, show its own chats + legacy (null) chats
    const isPrimary = account?.isDefault || account?.name?.toLowerCase().includes("primary");
    
    let filter = { whatsappAccountId: accountId };
    if (isPrimary) {
      filter = {
        $or: [
          { whatsappAccountId: accountId },
          { whatsappAccountId: { $exists: false } },
          { whatsappAccountId: null }
        ]
      };
    }

    const { page = 1, limit = 20, status, assignedTo, sector } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (status && status.toLowerCase() !== "all") filter.status = status;
    if (assignedTo && assignedTo.toLowerCase() !== "all") filter.assignedTo = assignedTo;
    if (sector && sector.toLowerCase() !== "all") filter.sector = sector;

    if (req.user.role === "Executive") {
      filter.assignedTo = req.user._id;
    }

    const total = await Conversation.countDocuments(filter);
    const conversations = await Conversation.find(filter)
      .populate("contact")
      .sort({ lastMessageTime: -1 })
      .skip(skip)
      .limit(Number(limit));

    console.log(`📂 API: Found ${conversations.length} conversations for account ${accountId} (Total matches: ${total})`);

    res.json({
      conversations,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalConversations: total,
      hasMore: skip + conversations.length < total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { phone } = req.params;
    const account = req.whatsappAccount;
    const accountId = account?._id;
    
    // SMART FILTER: Include legacy messages for default account
    let filter = { 
      $or: [{ from: phone }, { to: phone }] 
    };
    
    if (account?.isDefault) {
      filter = {
        $and: [
          { $or: [{ from: phone }, { to: phone }] },
          { $or: [
            { whatsappAccountId: accountId },
            { whatsappAccountId: { $exists: false } },
            { whatsappAccountId: null }
          ]}
        ]
      };
    } else {
      filter.whatsappAccountId = accountId;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Message.countDocuments(filter);

    // Update unread count only for current account context
    await Conversation.findOneAndUpdate(
      { phone, whatsappAccountId: accountId }, 
      { unreadCount: 0 }
    );
    
    res.json({
      messages: messages.reverse(),
      hasMore: total > skip + messages.length
    });
  } catch (err) {
    console.error(`❌ Error in ${req.url}:`, err.response?.data || err);
    res.status(500).json({ error: err.message });
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

    // Update conversation (check for existing with accountId OR null if default)
    let convFilter = { phone: to, whatsappAccountId: account._id };
    if (account.isDefault) {
      const existing = await Conversation.findOne({ phone: to, whatsappAccountId: account._id });
      if (!existing) {
        convFilter = { phone: to, $or: [{ whatsappAccountId: { $exists: false } }, { whatsappAccountId: null }] };
      }
    }

    const updatedConv = await Conversation.findOneAndUpdate(
      convFilter,
      { lastMessage: body, lastMessageTime: new Date(), unreadCount: 0, whatsappAccountId: account._id },
      { upsert: true, new: true }
    );

    if (updatedConv && updatedConv.contact) {
      await Contact.findByIdAndUpdate(updatedConv.contact, {
        whatsappAccountId: account._id
      });
    }

    const populatedConv = await Conversation.findById(updatedConv._id).populate("contact");
    smartEmit("new_message", { message: newMessage, conversation: populatedConv });
    await logActivity(req.user._id, "SEND_MESSAGE", `Sent text message: ${body.substring(0, 50)}...`, to);

    res.json({ success: true, message: newMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConversationStatus = async (req, res) => {
  try {
    const { phone, status } = req.body;
    const account = req.whatsappAccount;
    
    const conversation = await Conversation.findOneAndUpdate(
      { phone, $or: [{ whatsappAccountId: account?._id }, { whatsappAccountId: null }] },
      { 
        status,
        whatsappAccountId: account?._id 
      },
      { new: true }
    );

    if (conversation && conversation.contact) {
      await Contact.findByIdAndUpdate(conversation.contact, {
        status: status,
        statusUpdatedAt: new Date(),
        whatsappAccountId: account?._id
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

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body: `[Template: ${templateName}]`,
      type: "template",
      templateData: { name: templateName, components: templateComponents },
      direction: "outbound",
      whatsappAccountId: account._id
    });
    await newMessage.save();

    const updatedConv = await Conversation.findOneAndUpdate(
      { phone: to, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      { lastMessage: newMessage.body, lastMessageTime: new Date(), unreadCount: 0, whatsappAccountId: account._id },
      { upsert: true, new: true }
    );

    const populatedConv = await Conversation.findById(updatedConv._id).populate("contact");
    smartEmit("new_message", { message: newMessage, conversation: populatedConv });
    await logActivity(req.user._id, "SEND_TEMPLATE", `Sent template: ${templateName}`, to);

    res.json({ success: true, message: newMessage });
  } catch (err) {
    console.error(`❌ Error in ${req.url}:`, err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
};

export const sendChatImageMessage = async (req, res) => {
  try {
    const { imageUrl, caption } = req.body;
    const to = normalizePhone(req.body.to);
    const account = req.whatsappAccount;

    if (!account) throw new Error("No active WhatsApp account found");

    const metaRes = await sendImageMessage(account, to, imageUrl, caption);
    const messageId = metaRes.messages?.[0]?.id;

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body: caption || "Image sent",
      type: "image",
      mediaUrl: imageUrl,
      direction: "outbound",
      status: "sent",
      whatsappAccountId: account._id
    });
    await newMessage.save();

    const updatedConv = await Conversation.findOneAndUpdate(
      { phone: to, $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      { lastMessage: caption || "📷 Image", lastMessageTime: new Date(), unreadCount: 0, whatsappAccountId: account._id },
      { upsert: true, new: true }
    );

    const populatedConv = await Conversation.findById(updatedConv._id).populate("contact");
    smartEmit("new_message", { message: newMessage, conversation: populatedConv });
    await logActivity(req.user._id, "SEND_IMAGE", `Sent image: ${imageUrl}`, to);

    res.json({ success: true, message: newMessage });
  } catch (err) {
    console.error(`❌ Error in ${req.url}:`, err.response?.data || err);
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
    
    const assignedName = conversation.assignedTo ? conversation.assignedTo.name : "Unassigned";
    const sectorName = conversation.sector || "Unassigned";
    await logActivity(req.user._id, "ASSIGN_CHAT", `Assigned chat to ${assignedName} (Sector: ${sectorName})`, phone);

    res.json({ message: "Conversation assigned", conversation });
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
