import mongoose from "mongoose";

const flowStepSchema = new mongoose.Schema({
  question: { type: String, required: true },
  saveToField: { type: String, required: true }, // e.g. "city", "profession"
  delay: { type: Number, default: 2 } // Delay in seconds for this specific step
});

const flowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  triggerKeyword: { type: String, required: true, lowercase: true, trim: true },
  steps: [flowStepSchema],
  successMessage: { type: String, default: "Dhanyawad! Aapki saari details save ho gayi hain. 🙏" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Flow = mongoose.model("Flow", flowSchema);
export default Flow;
