import express from "express";
import { verifyWebhook, handleWebhook, handleGoogleSheetsWebhook } from "../controllers/webhookController.js";

const router = express.Router();

router.get("/", verifyWebhook);
router.post("/", handleWebhook);
router.post("/google-sheets", handleGoogleSheetsWebhook);

export default router;
