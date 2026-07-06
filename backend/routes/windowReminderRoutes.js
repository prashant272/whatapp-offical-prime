import express from "express";
import {
  getWindowReminders,
  createWindowReminder,
  updateWindowReminder,
  deleteWindowReminder
} from "../controllers/windowReminderController.js";

const router = express.Router();

router.route("/")
  .get(getWindowReminders)
  .post(createWindowReminder);

router.route("/:id")
  .put(updateWindowReminder)
  .delete(deleteWindowReminder);

export default router;
