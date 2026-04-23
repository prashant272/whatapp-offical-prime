import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", required: true },
  phone: { type: String, required: true, unique: true },
  lastMessage: { type: String },
  lastMessageTime: { type: Date, default: Date.now },
  unreadCount: { type: Number, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  status: { 
    type: String, 
    enum: ["New", "Interested", "Not Interested", "Follow-up", "Closed"], 
    default: "New" 
  }
});

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
