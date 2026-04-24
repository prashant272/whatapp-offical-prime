import Conversation from "../models/Conversation.js";
import Template from "../models/Template.js";
import Message from "../models/Message.js";
import { sendTextMessage, sendTemplateMessage } from "../services/whatsappService.js";
import { logActivity } from "../utils/activityLogger.js";
import { normalizePhone } from "../utils/phoneUtils.js";

export const getConversations = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "Executive") {
      filter.assignedTo = req.user._id;
    }

    const conversations = await Conversation.find(filter)
      .populate("contact")
      .populate("assignedTo", "name")
      .sort({ lastMessageTime: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { phone } = req.params;
    const messages = await Message.find({
      $or: [{ from: phone }, { to: phone }]
    }).sort({ timestamp: 1 });
    
    await Conversation.findOneAndUpdate({ phone }, { unreadCount: 0 });
    
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { body } = req.body;
    const to = normalizePhone(req.body.to);
    const metaRes = await sendTextMessage(to, body);
    console.log("📤 Meta Send Response:", metaRes);

    const messageId = metaRes.messages?.[0]?.id;

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body,
      direction: "outbound"
    });
    await newMessage.save();

    await Conversation.findOneAndUpdate(
      { phone: to },
      { lastMessage: body, lastMessageTime: new Date() },
      { upsert: true }
    );

    await logActivity(req.user._id, "SEND_MESSAGE", `Sent text message: ${body.substring(0, 50)}...`, to);

    res.json({ success: true, message: newMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConversationStatus = async (req, res) => {
  try {
    const { phone, status } = req.body;
    const conversation = await Conversation.findOneAndUpdate(
      { phone },
      { status },
      { new: true }
    );

    await logActivity(req.user._id, "UPDATE_STATUS", `Updated status to ${status}`, phone);

    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const sendChatTemplateMessage = async (req, res) => {
  try {
    const { templateName, templateComponents } = req.body;
    const to = normalizePhone(req.body.to);
    
    // Find template in DB to get correct language
    const template = await Template.findOne({ name: templateName });
    const lang = template ? template.language : "en_US";

    const metaRes = await sendTemplateMessage(to, templateName, lang, templateComponents);
    
    const messageId = metaRes.messages?.[0]?.id;

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body: `[Template: ${templateName}]`,
      type: "template",
      templateData: {
        name: templateName,
        components: templateComponents
      },
      direction: "outbound"
    });
    await newMessage.save();

    await Conversation.findOneAndUpdate(
      { phone: to },
      { lastMessage: newMessage.body, lastMessageTime: new Date() },
      { upsert: true }
    );

    await logActivity(req.user._id, "SEND_TEMPLATE", `Sent template: ${templateName}`, to);

    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const sendChatImageMessage = async (req, res) => {
  try {
    const { imageUrl, caption } = req.body;
    const to = normalizePhone(req.body.to);

    const metaRes = await sendImageMessage(to, imageUrl, caption);
    const messageId = metaRes.messages?.[0]?.id;

    const newMessage = new Message({
      messageId,
      from: "me",
      to,
      body: caption || "Image sent",
      type: "image",
      mediaUrl: imageUrl,
      direction: "outbound",
      status: "sent"
    });
    await newMessage.save();

    await Conversation.findOneAndUpdate(
      { phone: to },
      { lastMessage: caption || "📷 Image", lastMessageTime: new Date() },
      { upsert: true }
    );

    await logActivity(req.user._id, "SEND_IMAGE", `Sent image: ${imageUrl}`, to);

    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const assignConversation = async (req, res) => {
  try {
    const { phone, userId } = req.body;
    const conversation = await Conversation.findOneAndUpdate(
      { phone },
      { assignedTo: userId || null },
      { new: true }
    ).populate("assignedTo", "name");
    
    const assignedName = conversation.assignedTo ? conversation.assignedTo.name : "Unassigned";
    await logActivity(req.user._id, "ASSIGN_CHAT", `Assigned chat to ${assignedName}`, phone);

    res.json({ message: "Conversation assigned", conversation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
