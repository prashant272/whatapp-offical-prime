import StatusOption from "../models/StatusOption.js";

export const getStatuses = async (req, res) => {
  try {
    const statuses = await StatusOption.find({}).sort({ createdAt: 1 });
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addStatus = async (req, res) => {
  try {
    const { name, color } = req.body;
    
    const newStatus = new StatusOption({
      name,
      color: color || "#3498db"
    });
    
    await newStatus.save();
    res.json(newStatus);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteStatus = async (req, res) => {
  try {
    await StatusOption.findByIdAndDelete(req.params.id);
    res.json({ message: "Status deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
