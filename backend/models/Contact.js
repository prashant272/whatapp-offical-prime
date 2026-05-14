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

  // --- ADVANCED CRM FIELDS ---
  // Priority: 'Hot', 'Warm', 'Cold' or numerical score
  priority: { type: String, enum: ["Hot", "Warm", "Cold", null], default: null },
  
  // Internal tracking notes (Array of objects to keep history)
  internalNotes: [{
    content: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now }
  }],

  // Follow-up Reminders (Alarms)
  reminders: [{
    title: String,
    time: Date,
    isCompleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],

  // A log of all automated follow-up messages sent to this customer. 
  // Prevents the Cron job from sending the same message twice before the delay time is over.
  followUpsLog: [{ 
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "FollowUpRule" },
    lastSentAt: { type: Date, default: Date.now }
  }],
  isCampaignSent: { type: Boolean, default: false },
  isCampaignFailed: { type: Boolean, default: false }
}, { timestamps: true });

contactSchema.index({ phone: 1, whatsappAccountId: 1 }, { unique: true });
contactSchema.index({ whatsappAccountId: 1, createdAt: -1 });
contactSchema.index({ sector: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ assignedTo: 1 });
contactSchema.index({ isCampaignSent: 1, isCampaignFailed: 1 });

// Normalize phone to 12 digits (with 91) before saving
contactSchema.pre("save", function(next) {
  if (this.phone) {
    let clean = this.phone.toString().replace(/\D/g, ""); // Remove non-digits
    if (clean.length === 10) clean = "91" + clean;
    this.phone = clean;
  }
  next();
});

const Contact = mongoose.model("Contact", contactSchema);
export default Contact;
