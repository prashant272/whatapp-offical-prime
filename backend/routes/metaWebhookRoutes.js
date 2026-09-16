import express from "express";
import { verifyMetaWebhook, handleMetaWebhook } from "../controllers/metaWebhookController.js";

const router = express.Router();

// GET endpoint to verify Meta webhook (hub.challenge)
router.get("/", verifyMetaWebhook);

// POST endpoint to handle incoming Meta Lead Webhook events
router.post("/", handleMetaWebhook);

export default router;
