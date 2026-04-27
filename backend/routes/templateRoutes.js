import express from "express";
import { getTemplates, syncTemplates, createNewTemplate, deleteTemplate } from "../controllers/templateController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getTemplates);
router.get("/sync", syncTemplates);
router.post("/sync", syncTemplates);
router.post("/", createNewTemplate);
router.delete("/:id", deleteTemplate);

export default router;
