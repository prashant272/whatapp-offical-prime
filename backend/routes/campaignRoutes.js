import express from "express";
import { startCampaign, getAllCampaigns, updateCampaignStatus, retryFailedContacts } from "../controllers/campaignController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, restrictTo("Admin", "Manager"), startCampaign);
router.get("/", protect, restrictTo("Admin", "Manager"), getAllCampaigns);
router.patch("/:id/status", protect, restrictTo("Admin", "Manager"), updateCampaignStatus);
router.post("/:id/retry", protect, restrictTo("Admin", "Manager"), retryFailedContacts);

export default router;
