import mongoose from "mongoose";

const SheetIntegrationSchema = new mongoose.Schema({
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
  fieldMapping: { type: Object, default: {} },
  syncStats: {
    totalAdded: { type: Number, default: 0 },
    totalUpdated: { type: Number, default: 0 }
  }
}, { timestamps: true });

export default mongoose.model("SheetIntegration", SheetIntegrationSchema);
