import Flow from "../models/Flow.js";

export const getFlows = async (req, res) => {
  try {
    const flows = await Flow.find().sort({ createdAt: -1 });
    res.json(flows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createFlow = async (req, res) => {
  try {
    const { name, triggerKeyword, steps, whatsappAccountIds } = req.body;
    const newFlow = new Flow({ name, triggerKeyword, steps, whatsappAccountIds });
    await newFlow.save();
    res.json(newFlow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateFlow = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedFlow = await Flow.findByIdAndUpdate(id, req.body, { new: true });
    res.json(updatedFlow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteFlow = async (req, res) => {
  try {
    const { id } = req.params;
    await Flow.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
