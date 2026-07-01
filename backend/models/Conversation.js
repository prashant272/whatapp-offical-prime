import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", required: true },
  phone: { type: String, required: true },
  lastMessage: { type: String },
  lastMessageTime: { type: Date, default: Date.now },
  lastCustomerMessageAt: { type: Date },
  unreadCount: { type: Number, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  status: { type: String, default: "New" },
  sector: { type: String, default: "Unassigned" },
  subsector: { type: String, default: "Unassigned" },
  followUpTime: { type: Date },
  followUpActivity: { type: String },
  followUpNotified: { type: Boolean, default: false },
  windowReminderSentAt: { type: Date }
}, { timestamps: true });

conversationSchema.index({ whatsappAccountId: 1, lastMessageTime: -1 });
conversationSchema.index({ phone: 1, whatsappAccountId: 1 }, { unique: true });
conversationSchema.index({ status: 1, lastMessageTime: -1 });
conversationSchema.index({ assignedTo: 1, lastMessageTime: -1 });
conversationSchema.index({ sector: 1, lastMessageTime: -1 });
conversationSchema.index({ subsector: 1, lastMessageTime: -1 });
conversationSchema.index({ whatsappAccountId: 1, status: 1, lastMessageTime: -1 });
conversationSchema.index({ whatsappAccountId: 1, assignedTo: 1, lastMessageTime: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
