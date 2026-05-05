import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  getKeywordRules,
  createKeywordRule,
  updateKeywordRule,
  deleteKeywordRule
} from "../controllers/keywordRuleController.js";

const router = express.Router();

// Only admins should manage keyword rules
router.use(protect);
router.use(restrictTo("Admin"));

router.route("/")
  .get(getKeywordRules)
  .post(createKeywordRule);

router.route("/:id")
  .put(updateKeywordRule)
  .delete(deleteKeywordRule);

export default router;
