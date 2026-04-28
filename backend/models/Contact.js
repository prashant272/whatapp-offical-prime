import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  tags: [String],
  status: { type: String, default: null },
  isBlocked: { type: Boolean, default: false },
  statusUpdatedAt: { type: Date, default: null },
  followUpsLog: [{ 
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "FollowUpRule" },
    lastSentAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
});

contactSchema.index({ phone: 1, whatsappAccountId: 1 }, { unique: true });

const Contact = mongoose.model("Contact", contactSchema);
export default Contact;
