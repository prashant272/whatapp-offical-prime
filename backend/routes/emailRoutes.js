import express from "express";
import multer from "multer";
import {
  getEmailSettings,
  saveEmailSettings,
  deleteEmailSetting,
  testSmtpConnection,
  sendEmailOutbound,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getEmailLogs
} from "../controllers/emailController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// SMTP configurations - accessible to all authenticated users for their own profiles
router.get("/settings", protect, getEmailSettings);
router.post("/settings", protect, saveEmailSettings);
router.delete("/settings/:id", protect, deleteEmailSetting);
router.post("/settings/test", protect, testSmtpConnection);

// Send Email with optional attachments
router.post("/send", protect, upload.array("attachments"), sendEmailOutbound);

// Templates CRUD - accessible to all authenticated users for their own templates
router.get("/templates", protect, getTemplates);
router.post("/templates", protect, createTemplate);
router.put("/templates/:id", protect, updateTemplate);
router.delete("/templates/:id", protect, deleteTemplate);

// Email Sent Logs / History
router.get("/logs", protect, getEmailLogs);

export default router;
