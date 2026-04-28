import mongoose from "mongoose";

const followUpRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  // The specific Contact Status this rule listens for (e.g., "Interested")
  status: { type: String, required: true },
  
  // The actual text message to be sent to the customer
  messageText: { type: String, required: true },
  
  // How long the Cron Job should wait before sending this message
  delayDays: { type: Number, default: 0 },
  delayHours: { type: Number, default: 0 },
  delayMinutes: { type: Number, default: 0 },
  
  // Notice this is optional! Follow-up rules are GLOBAL and not restricted to one account.
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const FollowUpRule = mongoose.model("FollowUpRule", followUpRuleSchema);
export default FollowUpRule;
