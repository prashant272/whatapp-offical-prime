import mongoose from "mongoose";

const keywordRuleSchema = new mongoose.Schema({
  keyword: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  whatsappAccountIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "WhatsAppAccount"
  }],
  targetStatus: {
    type: String,
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const KeywordRule = mongoose.model("KeywordRule", keywordRuleSchema);
export default KeywordRule;
