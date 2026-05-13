import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";

export const getActivities = async (req, res) => {
  try {
    const { user: userId, action, startDate, endDate } = req.query;
    let filter = {};

    // RBAC for logs
    if (req.user.role === "Manager") {
      // Manager sees Executive logs and their own
      const executives = await User.find({ role: "Executive" }).select("_id");
      const execIds = executives.map(e => e._id);
      filter.user = { $in: [...execIds, req.user._id] };
    } else if (req.user.role === "Admin") {
      // Admin sees everything
      if (userId && userId !== "all") filter.user = userId;
    } else {
      // Executive only sees their own
      filter.user = req.user._id;
    }

    if (action && action !== "all") filter.action = action;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find(filter)
      .populate("user", "name role")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ActivityLog.countDocuments(filter);

    res.json({
      logs,
      total,
      hasMore: total > skip + logs.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserReport = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    if (!userId) return res.status(400).json({ error: "UserId is required" });

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
    }

    // 1. Stats from ActivityLog
    const activities = await ActivityLog.find({ user: userId, ...dateFilter });
    
    const stats = {
      logins: activities.filter(a => a.action === "LOGIN").length,
      logouts: activities.filter(a => a.action === "LOGOUT").length,
      messagesSent: activities.filter(a => a.action === "SEND_MESSAGE" || a.action === "SEND_TEMPLATE").length,
      statusUpdates: activities.filter(a => a.action === "UPDATE_STATUS").length,
      assignments: activities.filter(a => a.action === "ASSIGN_CHAT").length,
    };

    // 2. Stats from Conversation model (Current state)
    const conversations = await Conversation.find({ assignedTo: userId });
    
    const now = new Date();
    const followUpStats = {
      pending: conversations.filter(c => c.followUpTime && c.followUpTime > now).length,
      missed: conversations.filter(c => c.followUpTime && c.followUpTime <= now && c.status !== "Closed").length,
      totalAssigned: conversations.length
    };

    // 3. Get recent contact-level timeline for this user
    const contactTimeline = activities
      .filter(a => a.target && /^\d+$/.test(a.target)) // Simple phone number check
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);

    res.json({ stats, followUpStats, contactTimeline });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getContactTimeline = async (req, res) => {
  try {
    const { phone } = req.params;
    const activities = await ActivityLog.find({ target: phone })
      .populate("user", "name role")
      .sort({ timestamp: -1 });
    
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}