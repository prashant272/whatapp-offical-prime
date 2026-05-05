import mongoose from "mongoose";

const keywordRuleSchema = new mongoose.Schema({
  keyword: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
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
