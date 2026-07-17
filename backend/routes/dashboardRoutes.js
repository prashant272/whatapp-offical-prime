import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { getDashboardStats, bulkDeleteByStatus, getDbStats, estimateBulkDelete } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", protect, getDashboardStats);
router.post("/bulk-delete-by-status", protect, restrictTo("Admin"), bulkDeleteByStatus);
router.post("/bulk-delete-estimate", protect, restrictTo("Admin"), estimateBulkDelete);
router.get("/db-stats", protect, restrictTo("Admin"), getDbStats);

export default router;
