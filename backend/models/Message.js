import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, default: "text" },
  timestamp: { type: Date, default: Date.now },
  direction: { type: String, enum: ["inbound", "outbound"], required: true },
  status: { type: String, default: "received" }
});

const Message = mongoose.model("Message", messageSchema);
export default Message;
