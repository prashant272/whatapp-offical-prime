import express from "express";
import { getUsers, createUser, deleteUser } from "../controllers/userController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(protect, restrictTo("Admin", "Manager", "Executive"), getUsers)
  .post(protect, restrictTo("Admin"), createUser);

router.route("/:id")
  .delete(protect, restrictTo("Admin"), deleteUser);

export default router;
