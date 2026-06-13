import mongoose from "mongoose";

const emailInboxSchema = new mongoose.Schema({
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  smtpProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "EmailSetting", required: true },
  messageId: { type: String, required: true }, // Unique Message-ID from header to avoid duplicate syncs
  from: { type: String, required: true },
  fromName: { type: String },
  to: { type: String, required: true },
  subject: { type: String },
  bodyHtml: { type: String },
  bodyText: { type: String },
  date: { type: Date, required: true },
  seen: { type: Boolean, default: false },
  uid: { type: Number }
}, { timestamps: true });

// Index messageId for fast deduplication lookup
emailInboxSchema.index({ messageId: 1 }, { unique: true });
// Index userRef for query performance
emailInboxSchema.index({ userRef: 1 });

const EmailInbox = mongoose.model("EmailInbox", emailInboxSchema);
export default EmailInbox;
