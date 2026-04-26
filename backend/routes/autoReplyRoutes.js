import express from "express";
import { 
  getAutoReplies, 
  createAutoReply, 
  updateAutoReply, 
  deleteAutoReply 
} from "../controllers/autoReplyController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getAutoReplies);
router.post("/", protect, adminOnly, createAutoReply);
router.put("/:id", protect, adminOnly, updateAutoReply);
router.delete("/:id", protect, adminOnly, deleteAutoReply);

export default router;
