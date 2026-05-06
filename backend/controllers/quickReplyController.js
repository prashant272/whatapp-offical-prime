import QuickReply from "../models/QuickReply.js";
import { logActivity } from "../utils/activityLogger.js";

export const createQuickReply = async (req, res) => {
  try {
    const { name, content, mediaUrl, whatsappAccountIds } = req.body;
    const account = req.whatsappAccount;
    
    const reply = await QuickReply.create({
      name,
      content,
      mediaUrl,
      whatsappAccountIds: whatsappAccountIds || (account?.isAll ? [] : [account?._id]),
      createdBy: req.user._id
    });

    await logActivity(req.user._id, "CREATE_QUICK_REPLY", `Created quick reply: ${name}`, name);
    
    res.status(201).json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getQuickReplies = async (req, res) => {
  try {
    const account = req.whatsappAccount;
    if (!account) return res.status(400).json({ error: "No active account selected" });

    let query = {};
    if (!account.isAll) {
      // Return quick replies for this account OR global ones (empty array or missing)
      query = { 
        $or: [
          { whatsappAccountIds: account._id },
          { whatsappAccountIds: { $size: 0 } },
          { whatsappAccountIds: { $exists: false } }
        ]
      };
    }

    const replies = await QuickReply.find(query).sort({ createdAt: -1 });
    res.json(replies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteQuickReply = async (req, res) => {
  try {
    const reply = await QuickReply.findById(req.params.id);
    if (reply) {
      await logActivity(req.user._id, "DELETE_QUICK_REPLY", `Deleted quick reply: ${reply.name}`, reply.name);
      await QuickReply.deleteOne({ _id: req.params.id });
      res.json({ message: "Quick reply removed" });
    } else {
      res.status(404).json({ message: "Quick reply not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateQuickReply = async (req, res) => {
  try {
    const { name, content, mediaUrl, whatsappAccountIds } = req.body;
    const reply = await QuickReply.findById(req.params.id);
    
    if (!reply) {
      return res.status(404).json({ message: "Quick reply not found" });
    }

    reply.name = name || reply.name;
    reply.content = content !== undefined ? content : reply.content;
    reply.mediaUrl = mediaUrl !== undefined ? mediaUrl : reply.mediaUrl;
    reply.whatsappAccountIds = whatsappAccountIds !== undefined ? whatsappAccountIds : reply.whatsappAccountIds;
    
    const updatedReply = await reply.save();
    await logActivity(req.user._id, "UPDATE_QUICK_REPLY", `Updated quick reply: ${reply.name}`, reply.name);
    
    res.json(updatedReply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
