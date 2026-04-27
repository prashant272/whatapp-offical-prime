import mongoose from "mongoose";

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: "UTILITY" },
  language: { type: String, default: "en_US" },
  components: { type: Array, required: true },
  status: { type: String, default: "PENDING" },
  metaId: { type: String },
  rejectionReason: { type: String },
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" },
  createdAt: { type: Date, default: Date.now },
});

// Compound unique index: Name must be unique PER account
templateSchema.index({ name: 1, whatsappAccountId: 1 }, { unique: true });

const Template = mongoose.model("Template", templateSchema);
export default Template;
