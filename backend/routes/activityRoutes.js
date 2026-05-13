import express from "express";
import { getActivities, getUserReport, getContactTimeline } from "../controllers/activityController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getActivities);
router.get("/report", protect, getUserReport);
router.get("/timeline/:phone", protect, getContactTimeline);

export default router;
