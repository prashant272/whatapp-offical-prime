import FollowUpRule from "../models/FollowUpRule.js";

export const getFollowUpRules = async (req, res) => {
  try {
    const filter = req.whatsappAccount ? { whatsappAccountId: req.whatsappAccount._id } : {};
    const rules = await FollowUpRule.find(filter).sort({ createdAt: -1 });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createFollowUpRule = async (req, res) => {
  try {
    const { name, status, messageText, delayDays, delayHours, delayMinutes, active } = req.body;
    
    if (!req.whatsappAccount) {
      return res.status(400).json({ error: "WhatsApp Account context required" });
    }

    const newRule = new FollowUpRule({
      name,
      status,
      messageText,
      delayDays: Number(delayDays) || 0,
      delayHours: Number(delayHours) || 0,
      delayMinutes: Number(delayMinutes) || 0,
      whatsappAccountId: req.whatsappAccount._id,
      active: active !== undefined ? active : true
    });

    await newRule.save();
    res.status(201).json(newRule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateFollowUpRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await FollowUpRule.findOneAndUpdate(
      { _id: id, whatsappAccountId: req.whatsappAccount._id },
      req.body,
      { new: true }
    );
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteFollowUpRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await FollowUpRule.findOneAndDelete({ _id: id, whatsappAccountId: req.whatsappAccount._id });
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json({ message: "Rule deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
