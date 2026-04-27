import express from "express";
import { getStatuses, addStatus, deleteStatus } from "../controllers/statusController.js";
import { protect } from "../middleware/authMiddleware.js";
import { attachWhatsAppAccount } from "../middleware/accountMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(attachWhatsAppAccount);

router.get("/", getStatuses);
router.post("/", addStatus);
router.delete("/:id", deleteStatus);

export default router;
