import AutoReply from "../models/AutoReply.js";
import { logActivity } from "../utils/activityLogger.js";

export const getAutoReplies = async (req, res) => {
  try {
    const replies = await AutoReply.find().sort({ createdAt: -1 });
    res.json(replies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAutoReply = async (req, res) => {
  try {
    const { keyword, response, matchType } = req.body;
    const reply = new AutoReply({ keyword, response, matchType });
    await reply.save();
    
    await logActivity(req.user._id, "CREATE_AUTOREPLY", `Created auto-reply for: ${keyword}`);
    res.status(201).json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAutoReply = async (req, res) => {
  try {
    const { id } = req.params;
    const reply = await AutoReply.findByIdAndUpdate(id, req.body, { new: true });
    await logActivity(req.user._id, "UPDATE_AUTOREPLY", `Updated auto-reply: ${reply.keyword}`);
    res.json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAutoReply = async (req, res) => {
  try {
    const { id } = req.params;
    const reply = await AutoReply.findByIdAndDelete(id);
    await logActivity(req.user._id, "DELETE_AUTOREPLY", `Deleted auto-reply for: ${reply?.keyword}`);
    res.json({ message: "Auto-reply deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
