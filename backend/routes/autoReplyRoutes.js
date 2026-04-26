import express from "express";
import { 
  getAutoReplies, 
  createAutoReply, 
  updateAutoReply, 
  deleteAutoReply 
} from "../controllers/autoReplyController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getAutoReplies);
router.post("/", protect, restrictTo("Admin"), createAutoReply);
router.put("/:id", protect, restrictTo("Admin"), updateAutoReply);
router.delete("/:id", protect, restrictTo("Admin"), deleteAutoReply);

export default router;
