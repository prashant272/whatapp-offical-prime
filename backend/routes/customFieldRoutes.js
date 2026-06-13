import express from "express";
import CustomField from "../models/CustomField.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
  
// Get all fields for the active account
router.get("/", async (req, res) => {
  try {
    const accountId = req.headers["x-whatsapp-account-id"];
    if (!accountId) return res.status(400).json({ error: "Missing WhatsApp Account ID header" });

    let query = { 
      $or: [
        { whatsappAccountIds: accountId },
        { whatsappAccountId: accountId } // Backward compatibility
      ]
    };

    if (accountId === "all") {
      query = {}; // Return all fields
    }

    const fields = await CustomField.find(query).sort({ sortOrder: 1, createdAt: 1 });
    // For each field, sort options alphabetically if flag is set
    const processedFields = fields.map(f => {
      const obj = f.toObject();
      if (obj.optionsSortAlpha && obj.options?.length > 0) {
        obj.options = [...obj.options].sort((a, b) => a.localeCompare(b));
      }
      return obj;
    });
    res.json(processedFields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new field (Admin/Manager only)
router.post("/", restrictTo("Admin", "Manager"), async (req, res) => {
  try {
    const { name, label, type, options, whatsappAccountIds, sortOrder, optionsSortAlpha, applicableStatus } = req.body;
    const accountId = req.headers["x-whatsapp-account-id"];

    if (!name || !label) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Sort options alphabetically if requested
    let finalOptions = options || [];
    if (optionsSortAlpha && finalOptions.length > 0) {
      finalOptions = [...finalOptions].sort((a, b) => a.localeCompare(b));
    }

    const newField = new CustomField({
      name: name.toLowerCase().replace(/[^a-z0-9_]/g, ""),
      label,
      type,
      options: finalOptions,
      sortOrder: sortOrder || 0,
      optionsSortAlpha: optionsSortAlpha || false,
      whatsappAccountIds: whatsappAccountIds || [accountId],
      applicableStatus: applicableStatus || "All"
    });

    await newField.save();
    res.status(201).json(newField);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a field
router.delete("/:id", restrictTo("Admin"), async (req, res) => {
  try {
    await CustomField.findByIdAndDelete(req.params.id);
    res.json({ message: "Custom field deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a field
router.put("/:id", restrictTo("Admin", "Manager"), async (req, res) => {
  try {
    const { label, type, options, whatsappAccountIds, sortOrder, optionsSortAlpha, applicableStatus } = req.body;

    // Sort options alphabetically if requested
    let finalOptions = options || [];
    if (optionsSortAlpha && finalOptions.length > 0) {
      finalOptions = [...finalOptions].sort((a, b) => a.localeCompare(b));
    }

    const updatedField = await CustomField.findByIdAndUpdate(
      req.params.id,
      { label, type, options: finalOptions, whatsappAccountIds, sortOrder: sortOrder || 0, optionsSortAlpha: optionsSortAlpha || false, applicableStatus: applicableStatus || "All" },
      { new: true }
    );
    if (!updatedField) return res.status(404).json({ error: "Field not found" });
    res.json(updatedField);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
