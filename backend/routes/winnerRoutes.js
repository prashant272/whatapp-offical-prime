import express from "express";
import { getWinners, createWinner, deleteWinner } from "../controllers/winnerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(protect, getWinners)
  .post(protect, createWinner);

router.route("/:id")
  .delete(protect, deleteWinner);

export default router;
