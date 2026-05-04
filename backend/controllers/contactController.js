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
    const { search, status, tag, sector, showAllAccounts, page = 1, limit = 50, skip: skipParam } = req.query;

    let query = {};
    const isAll = showAllAccounts === "true" || accountId === "all";

    if (isAll || !accountId) {
      // Global search - no account filter
      query = {};
    } else {
      // Filter by specific account or unassigned
      query.$or = [
        { whatsappAccountId: accountId },
        { whatsappAccountId: null },
        { whatsappAccountId: { $exists: false } }
      ];
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

    const limitInt = parseInt(limit);
    const skip = skipParam ? parseInt(skipParam) : (parseInt(page) - 1) * limitInt;
    const total = await Contact.countDocuments(query);
    const rawContacts = await Contact.find(query)
      .populate("assignedTo", "name")
      .populate("whatsappAccountId", "name")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Optimized: Fetch all conversations for these contacts in ONE single query
    const contactIds = rawContacts.map(c => c._id);
    const convFilter = { contact: { $in: contactIds } };
    if (accountId && accountId !== "all") {
      convFilter.$or = [{ whatsappAccountId: accountId }, { whatsappAccountId: null }];
    }
    
    const allConvs = await Conversation.find(convFilter).select("_id contact").lean();
    
    // Create a lookup map: contactId -> conversationId
    const convMap = new Map();
    allConvs.forEach(conv => {
      convMap.set(conv.contact.toString(), conv._id);
    });

    const contacts = rawContacts.map(contact => ({
      ...contact,
      conversationId: convMap.get(contact._id.toString()) || null
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

export const getBulkDetails = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: "IDs array required" });
    }
    const contacts = await Contact.find({ _id: { $in: ids } }).select("phone").lean();
    res.json(contacts);
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

    const validAccountId = (whatsappAccountId && whatsappAccountId !== "all") ? whatsappAccountId : null;

    const bulkOps = contacts.map(c => ({
      updateOne: {
        filter: { phone: c.phone },
        update: {
          $set: {
            name: c.name,
            sector: c.sector,
            whatsappAccountId: validAccountId || (c.whatsappAccountId !== "all" ? c.whatsappAccountId : null),
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
        let targetAccountId = whatsappAccountId || contact.whatsappAccountId;
        
        // CRITICAL: Ensure we never try to save "all" as an ObjectId in Timeline
        if (!targetAccountId || targetAccountId === "all") return null;

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
    const accountId = req.headers["x-whatsapp-account-id"];
    let query = {};
    
    // If not 'all', filter tags by account (optional, but keep global for now as requested)
    if (accountId && accountId !== "all") {
      // query.whatsappAccountId = accountId; // Uncomment if we want account-specific tags
    }

    const tags = await Contact.distinct("tags", query);
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
    const normalizedFoundPhones = new Set(existingConversations.map(c => String(c.phone).replace(/[^0-9]/g, "")));

    const matchedOriginals = phones.filter(original => {
      const clean = String(original).replace(/[^0-9]/g, "");
      return normalizedFoundPhones.has(clean) ||
        normalizedFoundPhones.has("91" + clean) ||
        (clean.startsWith("91") && normalizedFoundPhones.has(clean.substring(2)));
    });

    // Fetch contact details (sectors) for matched numbers
    const contactsInfo = await Contact.find({
      phone: { $in: variationsArray }
    }).select("phone sector").lean();

    const result = matchedOriginals.map(original => {
      const clean = String(original).replace(/[^0-9]/g, "");
      const contact = contactsInfo.find(c => {
        const cClean = String(c.phone).replace(/[^0-9]/g, "");
        return cClean === clean || cClean === "91" + clean || (clean.startsWith("91") && cClean === clean.substring(2));
      });
      return {
        phone: original,
        sector: contact?.sector || "Unassigned"
      };
    });

    res.json({ existingPhones: matchedOriginals, contacts: result });
  } catch (err) {
    next(err);
  }
};

export const bulkUpdateContacts = async (req, res, next) => {
  try {
    const { phones, sector } = req.body;
    if (!phones || !Array.isArray(phones) || !sector) {
      return res.status(400).json({ error: "Phones list and sector are required" });
    }

    // Numbers variations to be safe
    const phoneVariations = new Set();
    phones.forEach(p => {
      const clean = String(p).replace(/[^0-9]/g, "");
      phoneVariations.add(clean);
      if (clean.length === 10) phoneVariations.add("91" + clean);
      if (clean.length === 12 && clean.startsWith("91")) phoneVariations.add(clean.substring(2));
    });

    const variationsArray = Array.from(phoneVariations);

    await Contact.updateMany(
      { phone: { $in: variationsArray } },
      { $set: { sector: sector } }
    );

    res.json({ success: true, message: `Updated ${phones.length} contacts to sector: ${sector}` });
  } catch (err) {
    next(err);
  }
};
