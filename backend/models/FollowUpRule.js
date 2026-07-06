import mongoose from "mongoose";

const followUpRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  // The specific Contact Status(es) this rule listens for (e.g., ["Interested", "Pending"])
  // We keep 'status' for backward compatibility but encourage 'statuses'
  status: { type: String },
  statuses: [{ type: String }],
  
  // The actual text message to be sent to the customer
  messageText: { type: String },
  
  // Optional media URL (e.g., from a selected quick reply)
  mediaUrl: { type: String },
  quickReplyId: { type: mongoose.Schema.Types.ObjectId, ref: "QuickReply" },
  templatePresetId: { type: mongoose.Schema.Types.ObjectId, ref: "TemplatePreset" },
  
  // How long the Cron Job should wait before sending this message
  delayDays: { type: Number, default: 0 },
  delayHours: { type: Number, default: 0 },
  delayMinutes: { type: Number, default: 0 },
  
  // If provided, the rule only applies to customers from these specific WhatsApp accounts
  whatsappAccountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" }],
  
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const FollowUpRule = mongoose.model("FollowUpRule", followUpRuleSchema);
export default FollowUpRule;
