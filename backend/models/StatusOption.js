import mongoose from "mongoose";

const statusOptionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  color: { type: String, default: "#3498db" }
}, { timestamps: true });

const StatusOption = mongoose.model("StatusOption", statusOptionSchema);
export default StatusOption;
