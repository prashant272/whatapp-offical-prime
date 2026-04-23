import express from "express";
import { verifyNumbers } from "../controllers/contactController.js";

const router = express.Router();

router.post("/verify", verifyNumbers);

export default router;
