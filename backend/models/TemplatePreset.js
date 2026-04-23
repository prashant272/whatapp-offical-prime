import mongoose from "mongoose";

const templatePresetSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: "Template", required: true },
  config: { 
    type: Map, 
    of: String 
  }, // Stores variable values like { "BODY_1": "Val", "HEADER_IMAGE": "url..." }
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

const TemplatePreset = mongoose.model("TemplatePreset", templatePresetSchema);
export default TemplatePreset;
