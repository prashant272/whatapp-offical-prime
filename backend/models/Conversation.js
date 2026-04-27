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
  status: { 
    type: String, 
    enum: ["New", "Interested", "Not Interested", "Follow-up", "Closed"], 
    default: "New" 
  }
}, { timestamps: true });

conversationSchema.index({ phone: 1, whatsappAccountId: 1 }, { unique: true });

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
