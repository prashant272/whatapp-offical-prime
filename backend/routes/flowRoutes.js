import express from "express";
import { getFlows, createFlow, updateFlow, deleteFlow } from "../controllers/flowController.js";

const router = express.Router();

router.get("/", getFlows);
router.post("/", createFlow);
router.put("/:id", updateFlow);
router.delete("/:id", deleteFlow);

export default router;
