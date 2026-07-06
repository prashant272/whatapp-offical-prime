import mongoose from "mongoose";

const windowReminderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  whatsappAccountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAccount' }],
  targetStatuses: [{ type: String }],
  message: { type: String, required: true },
  mediaUrl: { type: String, default: "" },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const WindowReminder = mongoose.model("WindowReminder", windowReminderSchema);
export default WindowReminder;
