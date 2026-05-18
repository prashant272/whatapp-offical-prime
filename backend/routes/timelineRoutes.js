import express from "express";
import mongoose from "mongoose";
import Timeline from "../models/Timeline.js";
import Contact from "../models/Contact.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET all manual timeline entries for a contact across ALL WhatsApp accounts
router.get("/:contactId", protect, async (req, res) => {
  try {
    const { contactId } = req.params;
    let phoneToSearch = null;

    if (mongoose.isValidObjectId(contactId)) {
      const contact = await Contact.findById(contactId).select("phone").lean();
      if (contact && contact.phone) {
        phoneToSearch = contact.phone;
      }
    } else if (/\d{10}/.test(contactId)) {
      phoneToSearch = contactId;
    }

    if (!phoneToSearch) {
      const entries = await Timeline.find({ contactId })
        .populate("createdBy", "name")
        .populate("whatsappAccountId", "name phoneNumber")
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
      
      const formatted = entries.map(e => ({
        ...e,
        whatsappAccountName: e.whatsappAccountId ? `${e.whatsappAccountId.name} (${e.whatsappAccountId.phoneNumber || ''})`.trim() : "Primary Account",
        isCampaign: false
      }));
      return res.json(formatted);
    }

    const cleanPhone = phoneToSearch.replace(/\D/g, "");
    const last10 = cleanPhone.slice(-10);
    
    // Exact indexed phone variations
    const phoneVariations = [last10, `91${last10}`, `+91${last10}`, `+${last10}`];

    // 1. Find matching contacts across all accounts using B-Tree index lookup ($in)
    const matchingContacts = await Contact.find({
      phone: { $in: phoneVariations }
    }).select("_id phone whatsappAccountId").lean();

    const contactIds = matchingContacts.map(c => c._id);

    // 2. Fetch recent 100 Timeline entries across all WABA account Contact IDs
    const timelineEntries = await Timeline.find({ contactId: { $in: contactIds } })
      .populate("createdBy", "name")
      .populate("whatsappAccountId", "name phoneNumber")
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    const formattedTimeline = timelineEntries.map(e => ({
      ...e,
      whatsappAccountName: e.whatsappAccountId ? `${e.whatsappAccountId.name} (${e.whatsappAccountId.phoneNumber || ''})`.trim() : "Primary Account",
      isCampaign: false
    }));

    res.json(formattedTimeline);
  } catch (error) {
    console.error("Timeline Merge Error:", error);
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
      timestamp: new Date()
    });

    await newEntry.save();
    await newEntry.populate("createdBy", "name");
    await newEntry.populate("whatsappAccountId", "name phoneNumber");

    const formatted = {
      ...newEntry.toObject(),
      whatsappAccountName: newEntry.whatsappAccountId ? `${newEntry.whatsappAccountId.name} (${newEntry.whatsappAccountId.phoneNumber || ''})`.trim() : "Primary Account",
      isCampaign: false
    };

    res.status(201).json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT (Edit) - Admin and Manager only
router.put("/:id", protect, restrictTo("Admin", "Manager"), async (req, res) => {
  try {
    const { content } = req.body;
    const entry = await Timeline.findByIdAndUpdate(
      req.params.id,
      { content, updatedAt: new Date() },
      { new: true }
    ).populate("createdBy", "name").populate("whatsappAccountId", "name phoneNumber");

    if (!entry) return res.status(404).json({ error: "Entry not found" });

    const formatted = {
      ...entry.toObject(),
      whatsappAccountName: entry.whatsappAccountId ? `${entry.whatsappAccountId.name} (${entry.whatsappAccountId.phoneNumber || ''})`.trim() : "Primary Account",
      isCampaign: false
    };

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Admin and Manager only
router.delete("/:id", protect, restrictTo("Admin", "Manager"), async (req, res) => {
  try {
    const entry = await Timeline.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
