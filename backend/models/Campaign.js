import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["MESSAGE", "VOICE"], default: "MESSAGE" },
  template: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
  totalContacts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  status: { type: String, enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "PAUSED"], default: "PENDING" },
  allowOutsideHours: { type: Boolean, default: false },
  contacts: [{ phone: String }], // Store the list of target contacts for resumption
  logs: [{
    phone: String,
    status: String,
    error: String,
    sentAt: { type: Date, default: Date.now }
  }],
  templateComponents: { type: Array, default: [] },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  startedAt: { type: Date },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

campaignSchema.index({ whatsappAccountId: 1, createdAt: -1 });
campaignSchema.index({ status: 1 });

const Campaign = mongoose.model("Campaign", campaignSchema);
export default Campaign;
