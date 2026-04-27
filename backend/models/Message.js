import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  messageId: { type: String, unique: true, sparse: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, default: "text" },
  mediaUrl: { type: String },
  templateData: {
    name: String,
    components: Array
  },
  timestamp: { type: Date, default: Date.now },
  direction: { type: String, enum: ["inbound", "outbound"], required: true },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  status: { type: String, default: "sent" }
}, { timestamps: true });

const Message = mongoose.model("Message", messageSchema);
export default Message;
