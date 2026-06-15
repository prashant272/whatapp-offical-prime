import { verifyContacts, blockUser, unblockUser } from "../services/whatsappService.js";
import Contact from "../models/Contact.js";
import Conversation from "../models/Conversation.js";
import Timeline from "../models/Timeline.js";
import Campaign from "../models/Campaign.js";
import Message from "../models/Message.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import { normalizePhone } from "../utils/phoneUtils.js";

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
    const { 
      search, status, tag, sector, subsector, showAllAccounts, 
      page = 1, limit = 50, skip: skipParam, onlyPhones, 
      assignedUsers, excludeUsers,
      statuses, excludeStatuses,
      campaignStatus, excludeCampaignStatus,
      campaignName,
      deleted
    } = req.query;

    let query = {};
    const isAll = showAllAccounts === "true" || accountId === "all" || !accountId;

    if (!isAll) {
      query.$or = [
        { whatsappAccountId: accountId },
        { whatsappAccountId: null },
        { whatsappAccountId: { $exists: false } }
      ];
    }

    if (deleted === "true") {
      query.isDeleted = true;
    } else {
      query.isDeleted = { $ne: true };
    }

    if (search) {
      const searchClean = search.toString().trim();
      const searchFilter = [
        { name: { $regex: searchClean, $options: "i" } },
        { phone: { $regex: searchClean, $options: "i" } }
      ];

      if (query.$or) {
        query = { $and: [{ $or: query.$or }, { $or: searchFilter }] };
      } else {
        query.$or = searchFilter;
      }
    }

    if (status) query.status = status;
    
    if (statuses) {
      const statusArr = Array.isArray(statuses) ? statuses : statuses.split(',');
      query.status = excludeStatuses === 'true' ? { $nin: statusArr } : { $in: statusArr };
    }

    if (assignedUsers) {
      const userArr = Array.isArray(assignedUsers) ? assignedUsers : assignedUsers.split(',');
      query.assignedTo = excludeUsers === 'true' ? { $nin: userArr } : { $in: userArr };
    }

    if (tag) query.tags = { $in: [tag] };
    
    if (sector) {
      const sectorArr = Array.isArray(sector) ? sector : sector.split(',');
      query.sector = { $in: sectorArr };
    }
    
    if (subsector) query.subsector = subsector;

    if (campaignName) {
      const campArr = Array.isArray(campaignName) ? campaignName : campaignName.split(',');
      query.$or = [
        { sourceCampaign: { $in: campArr } },
        { "accountsData.sourceCampaign": { $in: campArr } }
      ];
    }

    if (campaignStatus) {
      const statusArr = Array.isArray(campaignStatus) ? campaignStatus : campaignStatus.split(',');
      const orConditions = [];

      if (statusArr.includes('sent')) orConditions.push({ isCampaignSent: true });
      if (statusArr.includes('failed')) orConditions.push({ isCampaignFailed: true });
      if (statusArr.includes('unsent')) orConditions.push({ isCampaignSent: false, isCampaignFailed: false });

      if (orConditions.length > 0) {
        const campaignQuery = excludeCampaignStatus === 'true' ? { $and: orConditions.map(c => ({ $nor: [c] })) } : { $or: orConditions };
        
        if (query.$and) {
          query.$and.push(campaignQuery);
        } else {
          if (excludeCampaignStatus === 'true') {
            query.$and = [campaignQuery];
          } else {
            query.$or = query.$or ? [...query.$or, ...orConditions] : orConditions;
          }
        }
      }
    } else if (req.query.isCampaignSent !== undefined) {
      query.isCampaignSent = req.query.isCampaignSent === "true";
    }

    const limitInt = parseInt(limit) || 100;
    const skip = skipParam ? parseInt(skipParam) : (parseInt(page) - 1) * limitInt;
    const total = await Contact.countDocuments(query);

    // HIGH SPEED MODE for Campaign Manager loading (RESTORED)
    if (onlyPhones === 'true') {
      const rawContacts = await Contact.find(query)
        .select("phone")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitInt)
        .lean();
      
      return res.json({
        contacts: rawContacts,
        total,
        hasMore: total > skip + rawContacts.length,
        currentPage: parseInt(page)
      });
    }

    const rawContacts = await Contact.find(query)
      .select("name phone status sector subsector tags isCampaignSent whatsappAccountId createdAt updatedAt customFields accountsData")
      .populate("assignedTo", "name")
      .populate("whatsappAccountId", "name")
      .populate("accountsData.whatsappAccountId", "name phoneNumber")
      .populate("accountsData.assignedTo", "name")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitInt)
      .lean();


    // Optimized: Fetch all conversations for these contacts in ONE single query using phone
    const phoneVariations = new Set();
    rawContacts.forEach(c => {
      if (!c.phone) return;
      const clean = String(c.phone).replace(/[^0-9]/g, "");
      phoneVariations.add(clean);
      if (clean.length === 10) phoneVariations.add("91" + clean);
      if (clean.length === 12 && clean.startsWith("91")) phoneVariations.add(clean.substring(2));
      phoneVariations.add(c.phone); // Add original just in case
    });
    
    const phones = Array.from(phoneVariations);
    const convFilter = { phone: { $in: phones } };
    if (!isAll && accountId && accountId !== "all") {
      convFilter.$or = [{ whatsappAccountId: accountId }, { whatsappAccountId: null }];
    }
    
    const allConvs = await Conversation.find(convFilter)
      .select("_id phone whatsappAccountId lastMessageTime updatedAt")
      .sort({ lastMessageTime: -1, updatedAt: -1 })
      .lean();
    
    // Create a lookup map: phone -> conversationId
    const convMap = new Map();
    allConvs.forEach(conv => {
      if (!conv.phone) return;
      const clean = String(conv.phone).replace(/[^0-9]/g, "");
      const setIfMissing = (key) => {
        if (key && !convMap.has(key)) convMap.set(key, conv._id);
      };
      setIfMissing(clean);
      if (clean.length === 10) setIfMissing("91" + clean);
      if (clean.length === 12 && clean.startsWith("91")) setIfMissing(clean.substring(2));
      setIfMissing(conv.phone);
    });

    const contacts = rawContacts.map(contact => {
      const clean = String(contact.phone).replace(/[^0-9]/g, "");
      const topConvId = convMap.get(contact.phone) || convMap.get(clean) || null;

      // Attach specific conversationId inside accountsData
      let updatedAccountsData = [];
      if (contact.accountsData && contact.accountsData.length > 0) {
        updatedAccountsData = contact.accountsData.map(acc => {
          const accId = acc.whatsappAccountId?._id?.toString() || acc.whatsappAccountId?.toString();
          // Find conversation matching this whatsappAccountId and phone
          const matchedConv = allConvs.find(conv => {
            const convClean = String(conv.phone).replace(/[^0-9]/g, "");
            const contactClean = String(contact.phone).replace(/[^0-9]/g, "");
            const isPhoneMatch = conv.phone === contact.phone || convClean === contactClean;
            const isAccountMatch = conv.whatsappAccountId?.toString() === accId;
            return isPhoneMatch && isAccountMatch;
          });
          return {
            ...acc,
            conversationId: matchedConv?._id || null
          };
        });
      }

      return {
        ...contact,
        conversationId: topConvId,
        accountsData: updatedAccountsData
      };
    });

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

export const getContactById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contactObj = await Contact.findById(id)
      .populate("assignedTo", "name")
      .populate("whatsappAccountId", "name")
      .populate("accountsData.whatsappAccountId", "name phoneNumber")
      .populate("accountsData.assignedTo", "name")
      .lean();
    if (!contactObj) return res.status(404).json({ error: "Contact not found" });

    // Fetch conversations for this contact's phone
    const clean = String(contactObj.phone).replace(/[^0-9]/g, "");
    const allConvs = await Conversation.find({ phone: { $in: [contactObj.phone, clean] } }).lean();

    // Map conversationId to accountsData
    if (contactObj.accountsData && contactObj.accountsData.length > 0) {
      contactObj.accountsData = contactObj.accountsData.map(acc => {
        const accId = acc.whatsappAccountId?._id?.toString() || acc.whatsappAccountId?.toString();
        const matchedConv = allConvs.find(conv => conv.whatsappAccountId?.toString() === accId);
        return {
          ...acc,
          conversationId: matchedConv?._id || null
        };
      });
    }
    
    res.json(contactObj);
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

    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    // Meta API Block/Unblock Integration
    if (updateData.isBlocked !== undefined && updateData.isBlocked !== contact.isBlocked) {
      let activeAcc = req.whatsappAccount;
      if (!activeAcc && contact.whatsappAccountId) {
        activeAcc = await WhatsAppAccount.findById(contact.whatsappAccountId);
      }
      
      if (activeAcc) {
        try {
          if (updateData.isBlocked) {
            await blockUser(activeAcc, contact.phone);
            console.log(`✅ Blocked user ${contact.phone} on Meta WhatsApp API.`);
          } else {
            await unblockUser(activeAcc, contact.phone);
            console.log(`✅ Unblocked user ${contact.phone} on Meta WhatsApp API.`);
          }
        } catch (metaErr) {
          console.error("⚠️ Failed to block/unblock user on Meta Cloud API:", metaErr.response?.data || metaErr.message);
          return res.status(400).json({ error: `Meta API Error: ${metaErr.response?.data?.error?.message || metaErr.message}` });
        }
      } else {
        console.warn("⚠️ No active WhatsApp account context found to perform Meta block/unblock.");
      }
    }

    // Update ALL contact documents with the same phone number to sync across all WhatsApp accounts!
    await Contact.updateMany({ phone: contact.phone }, { $set: updateData });

    // SYNC: Update all conversations for this phone number to keep sector and subsector global
    if (updateData.sector !== undefined) {
      await Conversation.updateMany({ phone: contact.phone }, { $set: { sector: updateData.sector || "Unassigned" } });
    }
    if (updateData.subsector !== undefined) {
      await Conversation.updateMany({ phone: contact.phone }, { $set: { subsector: updateData.subsector || "Unassigned" } });
    }

    const updatedContact = await Contact.findById(id);

    res.json(updatedContact);
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

    let importedCount = 0;

    const bulkOps = contacts.map(c => {
      const normPhone = normalizePhone(c.phone);
      
      const newAccountId = validAccountId || (c.whatsappAccountId !== "all" ? c.whatsappAccountId : null);

      const setObj = {
        name: c.name,
        sector: c.sector,
        updatedAt: new Date() // Force bump to top
      };

      // Only overwrite whatsappAccountId if a specific account was chosen during import
      if (newAccountId) {
        setObj.whatsappAccountId = newAccountId;
      }

      // Merge custom fields using dot notation to prevent overwriting the whole Map
      if (c.customFields && typeof c.customFields === 'object') {
        Object.entries(c.customFields).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            setObj[`customFields.${key}`] = String(value);
          }
        });
      }

      const setOnInsertObj = {};
      if (!newAccountId) {
        setOnInsertObj.whatsappAccountId = null; // Default to Global if creating new lead
      }

      return {
        updateOne: {
          filter: { phone: normPhone },
          update: {
            $set: setObj,
            $setOnInsert: setOnInsertObj,
            $addToSet: { tags: { $each: c.tags || [] } }
          },
          upsert: true
        }
      };
    });


    if (bulkOps.length > 0) {
      // Chunking bulkWrite to avoid hitting command size limits
      const CHUNK_SIZE = 5000;
      for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
        const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
        await Contact.bulkWrite(chunk);
      }

      importedCount = bulkOps.length;

      // Log timeline for these contacts
      const phones = contacts.map(c => normalizePhone(c.phone));
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
          content: `Lead imported/updated via Excel (Tag: ${contacts.find(c => String(c.phone) === String(contact.phone))?.tags?.[0] || "None"})`,
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
    console.error("❌ Import Error Details:", err);
    next(err);
  }
};


export const checkImportDuplicates = async (req, res, next) => {
  try {
    const { phones } = req.body;
    if (!phones || !Array.isArray(phones)) {
      return res.status(400).json({ error: "Invalid phones list" });
    }

    const existingContacts = await Contact.find({ phone: { $in: phones } }).select("phone name").lean();
    res.json({ existingCount: existingContacts.length, duplicates: existingContacts });
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
    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    if (contact.isDeleted) {
      await Contact.deleteMany({ phone: contact.phone });
      res.json({ message: "Contact deleted permanently" });
    } else {
      await Contact.updateMany({ phone: contact.phone }, { $set: { isDeleted: true } });
      res.json({ message: "Contact moved to trash successfully" });
    }
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
    }).select("phone sector subsector").lean();

    const result = matchedOriginals.map(original => {
      const clean = String(original).replace(/[^0-9]/g, "");
      const contact = contactsInfo.find(c => {
        const cClean = String(c.phone).replace(/[^0-9]/g, "");
        return cClean === clean || cClean === "91" + clean || (clean.startsWith("91") && cClean === clean.substring(2));
      });
      return {
        phone: original,
        sector: contact?.sector || "Unassigned",
        subsector: contact?.subsector || "Unassigned"
      };
    });

    res.json({ existingPhones: matchedOriginals, contacts: result });
  } catch (err) {
    next(err);
  }
};

export const bulkUpdateContacts = async (req, res, next) => {
  try {
    const { phones, sector, subsector } = req.body;
    if (!phones || !Array.isArray(phones)) {
      return res.status(400).json({ error: "Phones list is required" });
    }

    const updateFields = {};
    if (sector !== undefined) updateFields.sector = sector || "Unassigned";
    if (subsector !== undefined) updateFields.subsector = subsector || "Unassigned";

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: "Sector or Subsector is required for update" });
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
      { $set: updateFields }
    );

    // SYNC: Update all conversations for these phone numbers to keep sector/subsector global
    await Conversation.updateMany(
      { phone: { $in: variationsArray } },
      { $set: updateFields }
    );

    res.json({ success: true, message: `Updated ${phones.length} contacts details successfully` });
  } catch (err) {
    next(err);
  }
};
export const addNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    contact.internalNotes.push({
      content,
      createdBy: req.user._id
    });
    await contact.save();
    
    const updated = await Contact.findById(id).populate("internalNotes.createdBy", "name");
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const addReminder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, time } = req.body;
    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    contact.reminders.push({ title, time });
    await contact.save();
    res.json(contact);
  } catch (err) {
    next(err);
  }
};

export const toggleReminder = async (req, res, next) => {
  try {
    const { id, reminderId } = req.params;
    const contact = await Contact.findById(id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const reminder = contact.reminders.id(reminderId);
    if (!reminder) return res.status(404).json({ error: "Reminder not found" });

    reminder.isCompleted = !reminder.isCompleted;
    await contact.save();
    res.json(contact);
  } catch (err) {
    next(err);
  }
};

export const checkCampaignHistory = async (req, res, next) => {
  try {
    const { phones } = req.body;
    if (!phones || !Array.isArray(phones)) {
      return res.status(400).json({ error: "Invalid phones list" });
    }

    const cleanPhones = phones.map(p => String(p).replace(/\D/g, "")).filter(Boolean);
    const phoneVariations = new Set();
    const phoneLookupMap = new Map();

    phones.forEach(original => {
      const cleanOriginal = String(original).replace(/\D/g, "");
      if (!cleanOriginal) return;
      
      phoneVariations.add(cleanOriginal);
      phoneLookupMap.set(cleanOriginal, original);

      if (cleanOriginal.length === 10) {
        const withCode = "91" + cleanOriginal;
        phoneVariations.add(withCode);
        phoneLookupMap.set(withCode, original);
      } else if (cleanOriginal.length === 12 && cleanOriginal.startsWith("91")) {
        const withoutCode = cleanOriginal.substring(2);
        phoneVariations.add(withoutCode);
        phoneLookupMap.set(withoutCode, original);
      }
    });

    const queryPhones = Array.from(phoneVariations);
    const queryPhonesSet = new Set(queryPhones);

    // Find campaigns containing these phones in logs with field projection
    const campaigns = await Campaign.find({
      "logs.phone": { $in: queryPhones }
    }, {
      name: 1,
      whatsappAccountId: 1,
      startedAt: 1,
      logs: 1
    })
    .populate("whatsappAccountId", "name")
    .lean();

    const history = [];

    campaigns.forEach(camp => {
      if (!camp.logs) return;
      
      camp.logs.forEach(log => {
        const cleanLogPhone = String(log.phone).replace(/\D/g, "");
        if (queryPhonesSet.has(cleanLogPhone)) {
          const matchedOriginal = phoneLookupMap.get(cleanLogPhone) || log.phone;
          history.push({
            phone: matchedOriginal,
            campaignName: camp.name,
            accountName: camp.whatsappAccountId?.name || "Primary Account",
            sentAt: log.sentAt || camp.startedAt,
            status: log.status
          });
        }
      });
    });

    res.json({ history });
  } catch (err) {
    next(err);
  }
};
