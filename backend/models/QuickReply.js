import mongoose from "mongoose";

const quickReplySchema = new mongoose.Schema({
  name: { type: String, required: true },
  content: { type: String },
  mediaUrl: { type: String },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

quickReplySchema.index({ name: 1, whatsappAccountId: 1 }, { unique: true });

const QuickReply = mongoose.model("QuickReply", quickReplySchema);
export default QuickReply;
