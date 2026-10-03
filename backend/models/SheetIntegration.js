import mongoose from "mongoose";

const SheetIntegrationSchema = new mongoose.Schema({
  name: { type: String, default: "Google Sheet Sync" },
  spreadsheetId: { type: String, required: true },
  spreadsheetUrl: { type: String, required: true },
  sheetName: { type: String, default: "Sheet1" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  lastSyncedAt: { type: Date },
  active: { type: Boolean, default: true },
  importTag: { type: String, default: "Google_Sheet_Import" },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  templatePreset: { type: mongoose.Schema.Types.ObjectId, ref: "TemplatePreset", default: null },
  defaultSource: { type: String, default: null },
  defaultSector: { type: String, default: null },
  messageInterval: { type: Number, default: 0 },
  fieldMapping: { type: Object, default: {} },
  syncStats: {
    totalAdded: { type: Number, default: 0 },
    totalUpdated: { type: Number, default: 0 }
  }
}, { timestamps: true });

export default mongoose.model("SheetIntegration", SheetIntegrationSchema);
