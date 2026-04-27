import Sector from "../models/Sector.js";

export const getSectors = async (req, res) => {
  try {
    const sectors = await Sector.find({}).sort({ name: 1 });
    res.json(sectors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addSector = async (req, res) => {
  try {
    const { name } = req.body;
    const newSector = new Sector({ name });
    await newSector.save();
    res.json(newSector);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteSector = async (req, res) => {
  try {
    await Sector.findByIdAndDelete(req.params.id);
    res.json({ message: "Sector deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
