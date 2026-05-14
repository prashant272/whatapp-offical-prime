import express from "express";
import { getConversations, getMessages, sendMessage, updateConversationStatus, sendChatTemplateMessage, assignConversation, sendChatImageMessage, markAsRead, getConversationById } from "../controllers/chatController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

import { smartEmit } from "../utils/socket.js";

const router = express.Router();

router.get("/conversations", protect, getConversations);
router.get("/messages/:phone", protect, getMessages);
router.post("/messages/send", protect, sendMessage);
router.post("/messages/send-image", protect, sendChatImageMessage);
router.post("/conversations/status", protect, updateConversationStatus);
router.put("/conversations/:id/status", protect, updateConversationStatus);
router.post("/messages/send-template", protect, sendChatTemplateMessage);
router.patch("/conversations/assign", protect, restrictTo("Admin", "Manager", "Executive"), assignConversation);
router.get("/conversations/:id", protect, getConversationById);
router.post("/conversations/mark-read", protect, markAsRead);
router.post("/messages/notify-admin-reply", protect, (req, res) => {
    const { phone, assignedTo, adminName } = req.body;
    smartEmit("admin_replied_alert", { phone, adminName, conversation: { assignedTo } });
    res.json({ success: true });
});

export default router;
