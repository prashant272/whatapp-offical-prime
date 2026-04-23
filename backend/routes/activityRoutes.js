import express from "express";
import { getActivities } from "../controllers/activityController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getActivities);

export default router;
