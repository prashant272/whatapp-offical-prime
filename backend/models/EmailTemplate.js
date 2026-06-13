import mongoose from "mongoose";

const emailTemplateSchema = new mongoose.Schema({
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true } // HTML or plain text content
}, { timestamps: true });

// Ensure unique template names per user
emailTemplateSchema.index({ userRef: 1, name: 1 }, { unique: true });

const EmailTemplate = mongoose.model("EmailTemplate", emailTemplateSchema);
export default EmailTemplate;
