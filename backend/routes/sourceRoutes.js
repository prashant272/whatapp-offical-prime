import express from "express";
import { getSources, createSource, updateSource, deleteSource } from "../controllers/sourceController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getSources);
router.post("/", protect, restrictTo("Admin", "Manager"), createSource);
router.put("/:id", protect, restrictTo("Admin", "Manager"), updateSource);
router.delete("/:id", protect, restrictTo("Admin", "Manager"), deleteSource);

export default router;
