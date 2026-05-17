import mongoose from "mongoose";

const customFieldSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "customer_city"
  label: { type: String, required: true }, // e.g., "Customer City"
  type: { 
    type: String, 
    enum: ["TEXT", "NUMBER", "DATE", "SELECT", "COMBOBOX"], 
    default: "TEXT" 
  },
  options: [String], // For SELECT/COMBOBOX type
  sortOrder: { type: Number, default: 0 }, // Display position (1=first, 2=second...)
  optionsSortAlpha: { type: Boolean, default: false }, // Sort COMBOBOX options A-Z
  whatsappAccountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" }],
  whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" }, // Backward compatibility
  createdAt: { type: Date, default: Date.now }
});

const CustomField = mongoose.model("CustomField", customFieldSchema);
export default CustomField;
