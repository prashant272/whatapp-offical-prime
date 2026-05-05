import express from "express";
import { createQuickReply, getQuickReplies, deleteQuickReply, updateQuickReply } from "../controllers/quickReplyController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getQuickReplies);
router.post("/", protect, restrictTo("Admin", "Manager"), createQuickReply);
router.put("/:id", protect, restrictTo("Admin", "Manager"), updateQuickReply);
router.delete("/:id", protect, restrictTo("Admin", "Manager"), deleteQuickReply);

export default router;
