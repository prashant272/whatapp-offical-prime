import express from "express";
import { verifyNumbers, getContacts, updateContact, deleteContact, importContacts, getUniqueTags, checkExistingConversations, bulkUpdateContacts, getBulkDetails } from "../controllers/contactController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.post("/verify", verifyNumbers);
router.post("/check-existing", checkExistingConversations);
router.post("/bulk-update", bulkUpdateContacts);
router.post("/bulk-details", getBulkDetails);
router.get("/", getContacts);
router.get("/tags", getUniqueTags);
router.post("/import", importContacts);
router.put("/:id", updateContact);
router.delete("/:id", deleteContact);

export default router;
