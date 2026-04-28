import mongoose from "mongoose";

const timelineSchema = new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", required: true },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true },
  content: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// Index for fast lookup by contact and account
timelineSchema.index({ contactId: 1, whatsappAccountId: 1 });

const Timeline = mongoose.model("Timeline", timelineSchema);
export default Timeline;
