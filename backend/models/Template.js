import mongoose from "mongoose";

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  category: { type: String, default: "UTILITY" },
  language: { type: String, default: "en_US" },
  components: { type: Array, required: true },
  status: { type: String, default: "PENDING" },
  metaId: { type: String },
  rejectionReason: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Template = mongoose.model("Template", templateSchema);
export default Template;
