import express from "express";
import { startCall } from "../controllers/callController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/initiate", protect, startCall);

export default router;
