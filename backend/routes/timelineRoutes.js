import express from "express";
import Timeline from "../models/Timeline.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET all entries for a contact on a specific account
router.get("/:contactId", protect, async (req, res) => {
  try {
    // Note: accountId is usually attached via middleware or can be passed as query/header
    // But since the contactId is already unique per account in this system, 
    // fetching by contactId is sufficient. However, we'll verify account for safety.
    const whatsappAccountId = req.headers["x-whatsapp-account-id"];
    
    const query = { contactId: req.params.contactId };
    if (whatsappAccountId) {
      query.whatsappAccountId = whatsappAccountId;
    }

    const entries = await Timeline.find(query)
      .populate("createdBy", "name")
      .sort({ timestamp: -1 });
      
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST a new entry
router.post("/", protect, async (req, res) => {
  try {
    const { contactId, whatsappAccountId, content } = req.body;
    
    if (!contactId || !whatsappAccountId || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newEntry = new Timeline({
      contactId,
      whatsappAccountId,
      content,
      createdBy: req.user._id,
      timestamp: new Date() // Use system time as requested
    });

    await newEntry.save();
    const populated = await newEntry.populate("createdBy", "name");
    
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT (Edit) - Admin only
router.put("/:id", protect, restrictTo("Admin"), async (req, res) => {
  try {
    const { content } = req.body;
    const entry = await Timeline.findByIdAndUpdate(
      req.params.id,
      { content },
      { new: true }
    ).populate("createdBy", "name");

    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Admin only
router.delete("/:id", protect, restrictTo("Admin"), async (req, res) => {
  try {
    const entry = await Timeline.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
