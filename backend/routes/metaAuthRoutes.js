import express from "express";
import { connectMetaPages, getConnectedPages, disconnectMetaPage, sendTestLead } from "../controllers/metaAuthController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Routes for Meta Ads / Facebook Page connection
router.post("/connect", protect, connectMetaPages);
router.get("/pages", protect, getConnectedPages);
router.delete("/pages/:id", protect, disconnectMetaPage);
router.post("/test-lead", protect, sendTestLead);

export default router;
