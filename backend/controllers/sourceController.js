import Source from "../models/Source.js";

export const getSources = async (req, res) => {
  try {
    const sources = await Source.find().sort({ createdAt: -1 });
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createSource = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Source name is required" });

    const exists = await Source.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (exists) return res.status(400).json({ error: "Source already exists" });

    const newSource = new Source({ name });
    await newSource.save();

    res.status(201).json(newSource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updatedSource = await Source.findByIdAndUpdate(id, { name }, { new: true });
    if (!updatedSource) return res.status(404).json({ error: "Source not found" });

    res.json(updatedSource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSource = async (req, res) => {
  try {
    const { id } = req.params;
    await Source.findByIdAndDelete(id);
    res.json({ message: "Source deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
