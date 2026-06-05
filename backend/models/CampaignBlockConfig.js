import mongoose from "mongoose";

const campaignBlockConfigSchema = new mongoose.Schema({
  key: { 
    type: String, 
    default: "default", 
    unique: true 
  },
  isEnabled: { 
    type: Boolean, 
    default: false 
  },
  blockedStatuses: [{ 
    type: String 
  }]
}, { timestamps: true });

const CampaignBlockConfig = mongoose.model("CampaignBlockConfig", campaignBlockConfigSchema);
export default CampaignBlockConfig;
