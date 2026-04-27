import express from "express";
import { 
  getAccounts, 
  addAccount, 
  updateAccount, 
  deleteAccount 
} from "../controllers/whatsAppAccountController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getAccounts);
router.post("/", protect, restrictTo("Admin"), addAccount);
router.put("/:id", protect, restrictTo("Admin"), updateAccount);
router.delete("/:id", protect, restrictTo("Admin"), deleteAccount);

export default router;
