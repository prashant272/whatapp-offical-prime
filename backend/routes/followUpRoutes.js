import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { attachWhatsAppAccount } from "../middleware/accountMiddleware.js";
import {
  getFollowUpRules,
  createFollowUpRule,
  updateFollowUpRule,
  deleteFollowUpRule
} from "../controllers/followUpController.js";

const router = express.Router();

// Apply middleware
router.use(protect);
router.use(attachWhatsAppAccount);

router.route("/")
  .get(getFollowUpRules)
  .post(createFollowUpRule);

router.route("/:id")
  .put(updateFollowUpRule)
  .delete(deleteFollowUpRule);

export default router;
