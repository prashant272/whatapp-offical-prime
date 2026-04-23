import express from "express";
import { startCampaign, getAllCampaigns } from "../controllers/campaignController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, restrictTo("Admin", "Manager"), startCampaign);
router.get("/", protect, restrictTo("Admin", "Manager"), getAllCampaigns);

export default router;
