import mongoose from "mongoose";

const customFieldSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "customer_city"
  label: { type: String, required: true }, // e.g., "Customer City"
  type: { 
    type: String, 
    enum: ["TEXT", "NUMBER", "DATE", "SELECT"], 
    default: "TEXT" 
  },
  options: [String], // For SELECT type
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount", required: true },
  createdAt: { type: Date, default: Date.now }
});

const CustomField = mongoose.model("CustomField", customFieldSchema);
export default CustomField;
