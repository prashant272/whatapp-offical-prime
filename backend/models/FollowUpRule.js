import mongoose from "mongoose";

const followUpRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, required: true },
  messageText: { type: String, required: true },
  delayDays: { type: Number, default: 0 },
  delayHours: { type: Number, default: 0 },
  delayMinutes: { type: Number, default: 0 },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const FollowUpRule = mongoose.model("FollowUpRule", followUpRuleSchema);
export default FollowUpRule;
