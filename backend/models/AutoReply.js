import mongoose from "mongoose";

const autoReplySchema = new mongoose.Schema({
  keyword: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true 
  },
  response: { 
    type: String, 
    required: true 
  },
  matchType: { 
    type: String, 
    enum: ["EXACT", "CONTAINS"], 
    default: "CONTAINS" 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  useCount: { 
    type: Number, 
    default: 0 
  },
  delay: { 
    type: Number, 
    default: 0 // Delay in seconds
  },
  whatsappAccountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" }]
}, { timestamps: true });

const AutoReply = mongoose.model("AutoReply", autoReplySchema);
export default AutoReply;
