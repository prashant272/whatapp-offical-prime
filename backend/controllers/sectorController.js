import Sector from "../models/Sector.js";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";

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
    const { name, subsectors } = req.body;
    const newSector = new Sector({ name, subsectors: subsectors || [] });
    await newSector.save();
    res.json(newSector);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateSector = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subsectors } = req.body;
    
    const sector = await Sector.findById(id);
    if (!sector) {
      return res.status(404).json({ error: "Sector not found" });
    }
    
    const oldName = sector.name;
    if (name !== undefined) sector.name = name;
    if (subsectors !== undefined) sector.subsectors = subsectors;
    
    await sector.save();
    
    // If the sector was renamed, we also rename the sector string in all Contact and Conversation documents!
    if (name && oldName !== name) {
      await Contact.updateMany({ sector: oldName }, { $set: { sector: name } });
      await Conversation.updateMany({ sector: oldName }, { $set: { sector: name } });
    }
    
    res.json(sector);
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
