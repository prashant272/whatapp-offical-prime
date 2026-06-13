import mongoose from "mongoose";

const emailSettingSchema = new mongoose.Schema({
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true }, // Custom Profile Name (e.g., "Brevo Official", "Support Gmail")
  type: { type: String, enum: ["gmail", "official"], required: true },
  host: { type: String, required: function() { return this.type === "official"; } },
  port: { type: Number, required: function() { return this.type === "official"; } },
  secure: { type: Boolean, default: false }, // true for 465, false for other ports
  user: { type: String, required: true }, // Gmail address or SMTP username
  pass: { type: String, required: true }, // Gmail app password or SMTP password
  senderName: { type: String, default: "WhatsApp Dashboard" },
  senderEmail: { type: String }, // Sender email (if different from user)
  imapHost: { type: String },
  imapPort: { type: Number },
  imapSecure: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure unique profile name per user
emailSettingSchema.index({ userRef: 1, name: 1 }, { unique: true });

const EmailSetting = mongoose.model("EmailSetting", emailSettingSchema);
export default EmailSetting;
