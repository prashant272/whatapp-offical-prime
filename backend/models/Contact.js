import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  
  // This tells us WHICH of our business WhatsApp accounts this customer is talking to.
  // It is extremely important for sending correct Follow-ups and AutoReplies.
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  sourceCampaign: { type: String, default: null },
  sector: { type: String, default: "Unassigned" },
  tags: [String],
  
  // The current label for this customer (e.g. "Interested", "Pending"). Used by the Cron Job.
  status: { type: String, default: null },
  isBlocked: { type: Boolean, default: false },
  
  // The exact time their status was changed. The Cron Job uses this to calculate the delay.
  statusUpdatedAt: { type: Date, default: null },
  
  // --- DYNAMIC AUTOMATION FLOWS ---
  // If the user is currently in a multi-step flow, this points to the Flow ID.
  activeFlowId: { type: mongoose.Schema.Types.ObjectId, ref: "Flow", default: null },
  currentStepIndex: { type: Number, default: 0 },
  
  // Temporary storage for data collected during a multi-step flow.
  chatData: { type: Map, of: String, default: {} },
  customFields: { type: Map, of: String, default: {} },

  // A log of all automated follow-up messages sent to this customer. 
  // Prevents the Cron job from sending the same message twice before the delay time is over.
  followUpsLog: [{ 
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "FollowUpRule" },
    lastSentAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

contactSchema.index({ phone: 1, whatsappAccountId: 1 }, { unique: true });

const Contact = mongoose.model("Contact", contactSchema);
export default Contact;
