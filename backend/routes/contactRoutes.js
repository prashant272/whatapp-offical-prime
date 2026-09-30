import express from "express";
import { verifyNumbers, getContacts, updateContact, deleteContact, importContacts, getUniqueTags, checkExistingConversations, bulkUpdateContacts, getBulkDetails, getContactById, addNote, addReminder, toggleReminder, checkImportDuplicates, checkCampaignHistory } from "../controllers/contactController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.post("/verify", verifyNumbers);
router.post("/check-existing", checkExistingConversations);
router.post("/check-campaign-history", checkCampaignHistory);
router.post("/bulk-update", bulkUpdateContacts);
router.post("/bulk-details", getBulkDetails);
router.get("/", getContacts);
router.get("/tags", getUniqueTags);
router.get("/sheets", (req, res, next) => import("../controllers/contactController.js").then(m => m.getRegisteredSheets(req, res, next)).catch(next));
router.get("/sheets/headers", (req, res, next) => import("../controllers/contactController.js").then(m => m.getSheetHeaders(req, res, next)).catch(next));
router.post("/sheets", (req, res, next) => import("../controllers/contactController.js").then(m => m.registerSheet(req, res, next)).catch(next));
router.delete("/sheets/:id", (req, res, next) => import("../controllers/contactController.js").then(m => m.deleteSheet(req, res, next)).catch(next));

router.get("/:id", getContactById);
router.post("/import", importContacts);
router.post("/check-import-duplicates", checkImportDuplicates);

router.patch("/:id", updateContact);
router.put("/:id", updateContact);
router.delete("/:id", deleteContact);

// Advanced CRM Routes
router.post("/:id/notes", addNote);
router.post("/:id/reminders", addReminder);
router.patch("/:id/reminders/:reminderId/toggle", toggleReminder);

export default router;
