import mongoose from "mongoose";

const flowStepOptionSchema = new mongoose.Schema({
  keywords: { type: String, required: true }, // comma-separated e.g. "yes, interested, haan"
  action: { type: String, enum: ["continue", "jump", "trigger_flow", "end"], default: "continue" },
  nextStepIndex: { type: Number, default: 0 },
  nextFlowId: { type: mongoose.Schema.Types.ObjectId, ref: "Flow", default: null },
  replyText: { type: String, default: "" }
});

const flowStepSchema = new mongoose.Schema({
  question: { type: String, required: true },
  saveToField: { type: String, required: true }, // e.g. "city", "profession"
  delay: { type: Number, default: 2 }, // Delay in seconds for this specific step
  type: { type: String, enum: ["text", "options"], default: "text" },
  options: [flowStepOptionSchema]
});

const flowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  triggerKeyword: { type: String, required: true, lowercase: true, trim: true },
  steps: [flowStepSchema],
  successMessage: { type: String, default: "Dhanyawad! Aapki saari details save ho gayi hain. 🙏" },
  isActive: { type: Boolean, default: true },
  whatsappAccountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" }]
}, { timestamps: true });

const Flow = mongoose.model("Flow", flowSchema);
export default Flow;
