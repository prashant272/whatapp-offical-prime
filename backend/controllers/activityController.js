import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";

export const getActivities = async (req, res) => {
  try {
    let filter = {};

    // RBAC for logs
    if (req.user.role === "Manager") {
      // Manager sees Executive logs and their own
      const executives = await User.find({ role: "Executive" }).select("_id");
      const execIds = executives.map(e => e._id);
      filter.user = { $in: [...execIds, req.user._id] };
    } else if (req.user.role === "Admin") {
      // Admin sees everything
      filter = {};
    } else {
      // Executive only sees their own
      filter.user = req.user._id;
    }

    const logs = await ActivityLog.find(filter)
      .populate("user", "name role")
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
