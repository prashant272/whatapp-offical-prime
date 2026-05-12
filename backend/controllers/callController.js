import WhatsAppAccount from "../models/WhatsAppAccount.js";
import Conversation from "../models/Conversation.js";
import { initiateWhatsAppCall } from "../services/callingService.js";
import { logActivity } from "../utils/activityLogger.js";

export const startCall = async (req, res) => {
  try {
    const { conversationId, type } = req.body; 
    console.log("📞 Incoming Call Request:", { conversationId, type });
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      console.warn("❌ Conversation not found:", conversationId);
      return res.status(404).json({ message: "Conversation not found" });
    }

    const account = await WhatsAppAccount.findById(conversation.whatsappAccountId);
    if (!account) {
      console.warn("❌ WhatsApp Account not found for conversation:", conversation.whatsappAccountId);
      return res.status(404).json({ message: "WhatsApp Account not found" });
    }

    console.log(`🚀 Initiating Meta Call to ${conversation.phone} using Account: ${account.name}`);
    const result = await initiateWhatsAppCall(account, conversation.phone, type);

    // Log the activity
    await logActivity({
      userId: req.user._id,
      action: "CALL_INITIATED",
      details: `${type === "video" ? "Video" : "Voice"} call initiated to ${conversation.phone}`,
      conversationId: conversation._id
    });

    res.status(200).json({ 
      success: true, 
      message: `${type} call initiated successfully`,
      data: result 
    });

  } catch (error) {
    console.error("❌ ERROR IN startCall:", error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to initiate call", 
      error: error.response?.data || error.message 
    });
  }
};
