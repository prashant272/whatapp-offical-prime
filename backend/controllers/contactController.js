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
    
    // Meta API has a limit on how many contacts can be verified in one call (usually ~1000)
    const CHUNK_SIZE = 1000;
    const results = [];
    
    for (let i = 0; i < sanitizedPhones.length; i += CHUNK_SIZE) {
      const chunk = sanitizedPhones.slice(i, i + CHUNK_SIZE);
      const chunkResults = await verifyContacts(req.whatsappAccount, chunk);
      results.push(...chunkResults);
    }

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
    if (req.query.isCampaignSent !== undefined) {
      query.isCampaignSent = req.query.isCampaignSent === "true";
    }

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
      // Chunking bulkWrite to avoid hitting command size limits
      const CHUNK_SIZE = 5000;
      for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
        const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
        await Contact.bulkWrite(chunk);
      }
      
      importedCount = bulkOps.length;

      // Log timeline for these contacts
      const phones = contacts.map(c => c.phone);
      const updatedContacts = [];
      for (let i = 0; i < phones.length; i += 10000) {
        const chunk = phones.slice(i, i + 10000);
        const chunkResults = await Contact.find({ phone: { $in: chunk } }).select("_id phone whatsappAccountId").lean();
        updatedContacts.push(...chunkResults);
      }

      const timelineOps = updatedContacts.map(contact => {
        const targetAccountId = whatsappAccountId || contact.whatsappAccountId;
        if (!targetAccountId) return null; // Skip timeline if no account ID found

        return {
          contactId: contact._id,
          whatsappAccountId: targetAccountId,
          content: `Lead imported/updated via Excel (Tag: ${contacts.find(c => c.phone === contact.phone)?.tags[0] || "None"})`,
          createdBy: req.user._id,
          timestamp: new Date()
        };
      }).filter(op => op !== null);

      if (timelineOps.length > 0) {
        for (let i = 0; i < timelineOps.length; i += CHUNK_SIZE) {
          const chunk = timelineOps.slice(i, i + CHUNK_SIZE);
          await Timeline.insertMany(chunk);
        }
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

export const checkExistingConversations = async (req, res, next) => {
  try {
    const { phones } = req.body;

    if (!phones || !Array.isArray(phones)) {
      return res.status(400).json({ error: "Invalid phones list" });
    }

    // Generate variations for each phone number to handle "91" issue
    // (with 91, without 91, with +91)
    const phoneVariations = new Set();
    phones.forEach(p => {
      const clean = String(p).replace(/[^0-9]/g, "");
      if (clean.length === 10) {
        phoneVariations.add(clean);
        phoneVariations.add("91" + clean);
        phoneVariations.add("+91" + clean);
      } else if (clean.length === 12 && clean.startsWith("91")) {
        phoneVariations.add(clean);
        phoneVariations.add(clean.substring(2));
        phoneVariations.add("+" + clean);
      } else {
        phoneVariations.add(p);
        if (!String(p).startsWith("+")) phoneVariations.add("+" + p);
      }
    });

    const variationsArray = Array.from(phoneVariations);

    // We check if a conversation exists for these phones across ALL accounts
    // Chunking the query to handle very large lists (40k+)
    const CHUNK_SIZE = 10000;
    const existingConversations = [];
    
    for (let i = 0; i < variationsArray.length; i += CHUNK_SIZE) {
      const chunk = variationsArray.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Conversation.find({
        phone: { $in: chunk }
      }).select("phone").lean();
      existingConversations.push(...chunkResults);
    }

    // Map found phones back to the original input numbers that matched
    // We use a Set for O(1) lookup speed instead of O(N*M) nested loops
    const normalizedFoundPhones = new Set(existingConversations.map(c => String(c.phone).replace(/[^0-9]/g, "")));
    
    const matchedOriginals = phones.filter(original => {
      const clean = String(original).replace(/[^0-9]/g, "");
      return normalizedFoundPhones.has(clean) || 
             normalizedFoundPhones.has("91" + clean) || 
             (clean.startsWith("91") && normalizedFoundPhones.has(clean.substring(2)));
    });

    res.json({ existingPhones: matchedOriginals });
  } catch (err) {
    next(err);
  }
};
