import mongoose from "mongoose";

const whatsappAccountSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Primary Sales", "Support"
  phoneNumberId: { type: String, required: true, unique: true },
  wabaId: { type: String, required: true },
  accessToken: { type: String, required: true },
  phoneNumber: { type: String }, // Optional display number
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  windowReminderActive: { type: Boolean, default: false },
  windowReminderMessage: { type: String, default: "Your 24-hour support window is closing in 1 hour. Please reply if you still need assistance." }
}, { timestamps: true });

const WhatsAppAccount = mongoose.model("WhatsAppAccount", whatsappAccountSchema);
export default WhatsAppAccount;
