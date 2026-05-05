import KeywordRule from "../models/KeywordRule.js";

export const getKeywordRules = async (req, res) => {
  try {
    const rules = await KeywordRule.find().populate("assignedTo", "name email");
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createKeywordRule = async (req, res) => {
  try {
    const { keyword, targetStatus, assignedTo, active } = req.body;
    const rule = new KeywordRule({
      keyword,
      targetStatus,
      assignedTo: assignedTo || null,
      active: active !== undefined ? active : true
    });
    await rule.save();
    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateKeywordRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await KeywordRule.findByIdAndUpdate(id, req.body, { new: true });
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteKeywordRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await KeywordRule.findByIdAndDelete(id);
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json({ message: "Rule deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
