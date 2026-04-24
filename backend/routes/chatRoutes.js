import express from "express";
import { getConversations, getMessages, sendMessage, updateConversationStatus, sendChatTemplateMessage, assignConversation, sendChatImageMessage } from "../controllers/chatController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/conversations", protect, getConversations);
router.get("/messages/:phone", protect, getMessages);
router.post("/messages/send", protect, sendMessage);
router.post("/messages/send-image", protect, sendChatImageMessage);
router.post("/conversations/status", protect, updateConversationStatus);
router.post("/messages/send-template", protect, sendChatTemplateMessage);
router.post("/conversations/assign", protect, restrictTo("Admin", "Manager"), assignConversation);

export default router;
