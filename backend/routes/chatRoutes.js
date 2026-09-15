import express from "express";
import { getConversations, getMessages, sendMessage, updateConversationStatus, sendChatTemplateMessage, assignConversation, sendChatImageMessage, markAsRead, getConversationById, resolveConversationByPhone } from "../controllers/chatController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

import { smartEmit } from "../utils/socket.js";

const router = express.Router();

router.get("/conversations", protect, getConversations);
router.get("/conversations/resolve", protect, resolveConversationByPhone);
router.get("/messages/:phone", protect, getMessages);
router.post("/messages/send", protect, sendMessage);
router.post("/messages/send-image", protect, sendChatImageMessage);
router.post("/conversations/status", protect, updateConversationStatus);
router.put("/conversations/:id/status", protect, updateConversationStatus);
router.post("/messages/send-template", protect, sendChatTemplateMessage);
router.patch("/conversations/assign", protect, restrictTo("Admin", "Manager", "Executive"), assignConversation);
router.put("/conversations/:id", protect, async (req, res) => {
    try {
        const Conversation = (await import("../models/Conversation.js")).default;
        const conv = await Conversation.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(conv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get("/conversations/:id", protect, getConversationById);
router.post("/conversations/mark-read", protect, markAsRead);
router.post("/messages/notify-admin-reply", protect, (req, res) => {
    const { phone, assignedTo, adminName } = req.body;
    smartEmit("admin_replied_alert", { phone, adminName, conversation: { assignedTo } });
    res.json({ success: true });
});

export default router;
