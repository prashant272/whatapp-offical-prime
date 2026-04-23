import ActivityLog from "../models/ActivityLog.js";

export const logActivity = async (userId, action, details, target = "") => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      details,
      target
    });
  } catch (error) {
    console.error("❌ Failed to log activity:", error);
  }
};
