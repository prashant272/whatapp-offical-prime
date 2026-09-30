import express from "express";
import { getAuthUrl, handleCallback, checkAuthStatus, disconnectGoogle } from "../controllers/googleAuthController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/auth", protect, getAuthUrl);
router.post("/callback", protect, handleCallback);
router.get("/status", protect, checkAuthStatus);
router.post("/disconnect", protect, disconnectGoogle);

export default router;
