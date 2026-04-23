import express from "express";
import { getAllTemplates, syncTemplates, createNewTemplate, deleteTemplate } from "../controllers/templateController.js";

import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getAllTemplates);
router.post("/sync", protect, restrictTo("Admin", "Manager"), syncTemplates);
router.post("/", protect, restrictTo("Admin", "Manager"), createNewTemplate);
router.delete("/:name", protect, restrictTo("Admin", "Manager"), deleteTemplate);

export default router;
