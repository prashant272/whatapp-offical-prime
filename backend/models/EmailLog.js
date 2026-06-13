import mongoose from "mongoose";

const emailLogSchema = new mongoose.Schema({
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  smtpProfileName: { type: String, required: true }, // Store name of SMTP profile (e.g. "Brevo Support")
  to: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, enum: ["success", "failed"], required: true },
  attachments: [{ type: String }],
  errorMessage: { type: String }
}, { timestamps: true });

const EmailLog = mongoose.model("EmailLog", emailLogSchema);
export default EmailLog;
