import express from "express";
import { 
  startCampaign, 
  getAllCampaigns, 
  getCampaignDetails, 
  updateCampaignStatus, 
  retryFailedContacts, 
  deleteCampaign,
  getCampaignBlockConfig,
  updateCampaignBlockConfig
} from "../controllers/campaignController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, restrictTo("Admin", "Manager"), startCampaign);
router.get("/", protect, restrictTo("Admin", "Manager"), getAllCampaigns);
router.get("/block-config", protect, getCampaignBlockConfig);
router.post("/block-config", protect, restrictTo("Admin", "Manager"), updateCampaignBlockConfig);
router.get("/:id", protect, restrictTo("Admin", "Manager"), getCampaignDetails);
router.patch("/:id/status", protect, restrictTo("Admin", "Manager"), updateCampaignStatus);
router.post("/:id/retry", protect, restrictTo("Admin", "Manager"), retryFailedContacts);
router.delete("/:id", protect, restrictTo("Admin", "Manager"), deleteCampaign);

export default router;
