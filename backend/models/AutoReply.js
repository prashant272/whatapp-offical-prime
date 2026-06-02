import mongoose from "mongoose";

const replySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["text", "image", "quick_reply"],
    default: "text"
  },
  text: { type: String },
  mediaUrl: { type: String },
  quickReplyId: { type: mongoose.Schema.Types.ObjectId, ref: "QuickReply" },
  delay: { type: Number, default: 0 }
});

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
    required: false 
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
  whatsappAccountIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "WhatsAppAccount" }],
  replies: [replySchema]
}, { timestamps: true });

const AutoReply = mongoose.model("AutoReply", autoReplySchema);
export default AutoReply;
