import express from "express";
import { createPreset, getPresets, deletePreset } from "../controllers/presetController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getPresets);
router.post("/", protect, restrictTo("Admin", "Manager"), createPreset);
router.delete("/:id", protect, restrictTo("Admin", "Manager"), deletePreset);

export default router;
