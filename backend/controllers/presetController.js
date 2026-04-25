import TemplatePreset from "../models/TemplatePreset.js";
import { logActivity } from "../utils/activityLogger.js";

export const createPreset = async (req, res) => {
  try {
    const { name, template, config } = req.body;
    
    const preset = await TemplatePreset.create({
      name,
      template,
      config,
      createdBy: req.user._id
    });

    await logActivity(req.user._id, "CREATE_PRESET", `Created template preset: ${name}`, name);
    
    res.status(201).json(preset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPresets = async (req, res) => {
  try {
    const presets = await TemplatePreset.find().populate("template");
    res.json(presets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePreset = async (req, res) => {
  try {
    const preset = await TemplatePreset.findById(req.params.id);
    if (preset) {
      await logActivity(req.user._id, "DELETE_PRESET", `Deleted preset: ${preset.name}`, preset.name);
      await TemplatePreset.deleteOne({ _id: req.params.id });
      res.json({ message: "Preset removed" });
    } else {
      res.status(404).json({ message: "Preset not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePreset = async (req, res) => {
  try {
    const { name, config } = req.body;
    const preset = await TemplatePreset.findById(req.params.id);
    
    if (!preset) {
      return res.status(404).json({ message: "Preset not found" });
    }

    preset.name = name || preset.name;
    preset.config = config || preset.config;
    
    const updatedPreset = await preset.save();
    await logActivity(req.user._id, "UPDATE_PRESET", `Updated preset: ${preset.name}`, preset.name);
    
    res.json(updatedPreset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
