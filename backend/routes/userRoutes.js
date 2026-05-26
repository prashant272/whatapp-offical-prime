import express from "express";
import { getUsers, createUser, deleteUser, updateUser, impersonateUser } from "../controllers/userController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(protect, restrictTo("Admin", "Manager", "Executive"), getUsers)
  .post(protect, restrictTo("Admin"), createUser);

router.route("/:id")
  .put(protect, restrictTo("Admin"), updateUser)
  .delete(protect, restrictTo("Admin"), deleteUser);

router.route("/:id/impersonate")
  .post(protect, restrictTo("Admin"), impersonateUser);

export default router;
