import express from "express";
import { getSectors, addSector, deleteSector } from "../controllers/sectorController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getSectors);
router.post("/", addSector);
router.delete("/:id", deleteSector);

export default router;
