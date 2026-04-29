import { verifyContacts } from "../services/whatsappService.js";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";
import Timeline from "../models/Timeline.js";

export const verifyNumbers = async (req, res, next) => {
  try {
    const { phones } = req.body;
    if (!phones || !Array.isArray(phones)) {
      return res.status(400).json({ error: "Invalid phones list. Expected an array of strings." });
    }

    // Numbers must be strings
    const sanitizedPhones = phones.map(p => String(p).startsWith("+") ? String(p) : `+${String(p)}`);

    console.log(`🔍 Verifying ${sanitizedPhones.length} contacts with Meta Cloud API...`);
    const results = await verifyContacts(sanitizedPhones);
    res.json({ results });
  } catch (err) {
    next(err);
  }
};

export const getContacts = async (req, res, next) => {
  try {
    const accountId = req.headers["x-whatsapp-account-id"];
    const { search, status, tag, sector, showAllAccounts, page = 1, limit = 50 } = req.query;
    
    let query = {};
    const PRIMARY_ID = "69ef020c6c021bd0911d62c2";

    if (showAllAccounts !== "true") {
      if (!accountId) return res.status(400).json({ error: "Missing WhatsApp Account ID header" });
      
      if (accountId === PRIMARY_ID) {
        query.$or = [
          { whatsappAccountId: accountId },
          { whatsappAccountId: null }
        ];
      } else {
        query.whatsappAccountId = accountId;
      }
    }

    if (search) {
      const searchFilter = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
      
      if (query.$or) {
        query = { $and: [{ $or: query.$or }, { $or: searchFilter }] };
      } else {
        query.$or = searchFilter;
      }
    }
    
    if (status) query.status = status;
    if (tag) query.tags = { $in: [tag] };
    if (sector) query.sector = sector;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Contact.countDocuments(query);
    const rawContacts = await Contact.find(query)
      .populate("assignedTo", "name")
      .populate("whatsappAccountId", "name")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Attach conversationId to each contact
    const contacts = await Promise.all(rawContacts.map(async (contact) => {
      const conv = await Conversation.findOne({ 
        contact: contact._id,
        $or: [{ whatsappAccountId: accountId }, { whatsappAccountId: null }] 
      }).select("_id");
      return { ...contact, conversationId: conv?._id };
    }));
      
    res.json({
      contacts,
      total,
      hasMore: total > skip + rawContacts.length,
      currentPage: parseInt(page)
    });
  } catch (err) {
    next(err);
  }
};

export const updateContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const contact = await Contact.findByIdAndUpdate(id, updateData, { new: true });
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    res.json(contact);
  } catch (err) {
    next(err);
  }
};

export const importContacts = async (req, res, next) => {
  try {
    const { contacts, whatsappAccountId } = req.body;
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: "Invalid contacts list" });
    }

    let importedCount = 0;
    const bulkOps = contacts.map(c => ({
      updateOne: {
        filter: { phone: c.phone },
        update: { 
          $set: { 
            name: c.name,
            sector: c.sector,
            whatsappAccountId: whatsappAccountId || c.whatsappAccountId,
            customFields: c.customFields
          },
          $addToSet: { tags: { $each: c.tags || [] } }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await Contact.bulkWrite(bulkOps);
      importedCount = bulkOps.length;

      // Log timeline for these contacts
      // For efficiency, we only log for newly created or updated contacts in this session
      const phones = contacts.map(c => c.phone);
      const updatedContacts = await Contact.find({ phone: { $in: phones } });
      
      const timelineOps = updatedContacts.map(contact => ({
        contactId: contact._id,
        whatsappAccountId: whatsappAccountId || contact.whatsappAccountId,
        content: `Lead imported/updated via Excel (Tag: ${contacts.find(c => c.phone === contact.phone)?.tags[0] || "None"})`,
        createdBy: req.user._id,
        timestamp: new Date()
      }));

      if (timelineOps.length > 0) {
        await Timeline.insertMany(timelineOps);
      }
    }

    res.json({ success: true, count: importedCount });
  } catch (err) {
    next(err);
  }
};

export const getUniqueTags = async (req, res, next) => {
  try {
    const tags = await Contact.distinct("tags");
    res.json(tags.filter(t => t && t.trim() !== ""));
  } catch (err) {
    next(err);
  }
};

export const deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findByIdAndDelete(id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    res.json({ message: "Contact deleted successfully" });
  } catch (err) {
    next(err);
  }
};
