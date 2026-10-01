import { google } from 'googleapis';
import User from '../models/User.js';
import SheetIntegration from '../models/SheetIntegration.js';
import Contact from '../models/Contact.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { sendTemplateMessage } from './whatsappService.js';

const getOauth2Client = () => {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
};

const buildTemplateComponents = (template, configObj, contactName, contactPhone) => {
  const components = [];
  if (!template || !template.components) return components;

  template.components.forEach(comp => {
    if (comp.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
      const url = configObj.get ? configObj.get(`HEADER_${comp.format}`) : configObj[`HEADER_${comp.format}`];
      if (url) {
        components.push({
          type: "header",
          parameters: [{ type: comp.format.toLowerCase(), [comp.format.toLowerCase()]: { link: url } }]
        });
      }
    }
    const matches = comp.text?.match(/{{(\d+)}}/g);
    if (matches) {
      const parameters = [];
      matches.forEach(m => {
        const num = m.replace(/{{|}}/g, "");
        let val = configObj.get ? configObj.get(`${comp.type}_${num}`) : configObj[`${comp.type}_${num}`];
        val = val || "";
        if (val === "[Name]" || val.toLowerCase() === "[name]") val = contactName || "Friend";
        if (val === "[Phone]" || val.toLowerCase() === "[phone]") val = contactPhone || "";
        parameters.push({ type: "text", text: val });
      });
      if (parameters.length > 0) {
        components.push({ type: comp.type.toLowerCase(), parameters });
      }
    }
  });
  return components;
};

const sendAutoMessage = async (account, toPhone, toName, preset) => {
  try {
    const template = preset.template;
    if (!template) return;
    const components = buildTemplateComponents(template, preset.config, toName, toPhone);
    const lang = template.language || "en_US";

    const metaRes = await sendTemplateMessage(account, toPhone, template.name, lang, components);
    const messageId = metaRes.messages?.[0]?.id;

    let messageBody = `[Template: ${template.name}]`;
    const bodyComp = template.components.find(c => c.type === "BODY");
    if (bodyComp && bodyComp.text) {
      let text = bodyComp.text;
      const bodyParams = components.find(c => c.type === "body")?.parameters || [];
      bodyParams.forEach((p, idx) => { text = text.replace(`{{${idx + 1}}}`, p.text || ""); });
      messageBody = text;
    }

    const newMessage = new Message({
      messageId,
      from: "me",
      to: toPhone,
      body: messageBody,
      type: "template",
      templateData: { name: template.name, components },
      direction: "outbound",
      whatsappAccountId: account._id,
      status: messageId ? "sent" : "failed"
    });
    await newMessage.save();

    await Conversation.findOneAndUpdate(
      { phone: toPhone.toString().replace(/\D/g, ""), $or: [{ whatsappAccountId: account._id }, { whatsappAccountId: null }] },
      {
        lastMessage: newMessage.body,
        lastMessageTime: new Date(),
        whatsappAccountId: account._id
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error(`Failed to auto-send message to ${toPhone}:`, error.message);
  }
};

export const syncGoogleSheets = async () => {
  try {
    const integrations = await SheetIntegration.find({ active: true })
      .populate('whatsappAccountId')
      .populate({ path: 'templatePreset', populate: { path: 'template' } });
    if (integrations.length === 0) return;

    const adminUser = await User.findOne({ googleRefreshToken: { $exists: true } });
    if (!adminUser) return;

    const oauth2Client = getOauth2Client();
    oauth2Client.setCredentials({ refresh_token: adminUser.googleRefreshToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    for (const integration of integrations) {
      try {
        const queryRange = (integration.sheetName && integration.sheetName !== 'Sheet1') 
                             ? `${integration.sheetName}!A:Z` 
                             : 'A:Z';
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: integration.spreadsheetId,
          range: queryRange,
          valueRenderOption: 'UNFORMATTED_VALUE'
        });

        const rows = response.data.values;
        console.log(`Fetched ${rows?.length} rows from sheet`);
        if (!rows || rows.length <= 1) continue;

        const headers = rows[0];
        const fieldMapping = integration.fieldMapping || {};
        
        const findIdx = (mappedKey, fallbackKeys) => {
          if (fieldMapping[mappedKey]) {
            return headers.findIndex(h => h === fieldMapping[mappedKey]);
          }
          const lowerHeaders = headers.map(h => h.trim().toLowerCase());
          return lowerHeaders.findIndex(h => fallbackKeys.some(fk => h.includes(fk)));
        };

        const phoneIdx = findIdx('phone', ['phone', 'mobile', 'number']);
        const nameIdx = findIdx('name', ['name']);
        const emailIdx = findIdx('email', ['email']);
        const sectorIdx = findIdx('sector', ['sector', 'industry']);
        const sourceIdx = findIdx('source', ['source', 'lead source']);

        if (phoneIdx === -1) {
           console.log('Skipping sheet because phoneIdx is -1');
           continue;
        }

        let addedCount = 0;
        let updatedCount = 0;

        const validRows = [];
        const seenPhones = new Set();
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rawPhone = row[phoneIdx];
          if (!rawPhone) continue;
          
          let phone = String(rawPhone).replace(/[^0-9]/g, '');
          if (phone.length === 10) phone = '91' + phone;
          if (phone.length < 10) continue;
          
          if (seenPhones.has(phone)) continue;
          seenPhones.add(phone);

          validRows.push({ row, phone });
        }

        const BATCH_SIZE = 5000;
        const chunkPromises = [];

        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          
          chunkPromises.push((async () => {
            let localAdded = 0;
            let localUpdated = 0;
            const newContactsToMessage = [];
            
            const batchPhones = batch.map(b => b.phone);
            const existingContacts = await Contact.find({ phone: { $in: batchPhones } });
            const contactMap = new Map();
            for (const c of existingContacts) contactMap.set(c.phone, c);

            const bulkOps = [];
            const convBulkOps = [];
            
            for (const item of batch) {
              const { row, phone } = item;
              const name = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : 'Unknown';
              const email = emailIdx !== -1 ? row[emailIdx] : null;
              const sector = sectorIdx !== -1 ? row[sectorIdx] : null;
              const source = sourceIdx !== -1 ? row[sourceIdx] : null;

              let customFields = {};
              for (const [key, value] of Object.entries(fieldMapping)) {
                if (key.startsWith('customFields.')) {
                  const cfName = key.replace('customFields.', '');
                  const cfIdx = headers.findIndex(h => h === value);
                  if (cfIdx !== -1 && row[cfIdx]) customFields[cfName] = row[cfIdx];
                }
              }
              
              headers.forEach((header, index) => {
                 if (index !== phoneIdx && index !== nameIdx && index !== emailIdx && index !== sectorIdx && index !== sourceIdx) {
                    if (row[index] && !Object.values(fieldMapping).includes(header)) {
                       customFields[header] = row[index];
                    }
                 }
              });

              const contact = contactMap.get(phone);
              if (contact) {
                let updateFields = {};
                if (name && name !== 'Unknown' && contact.name === 'Unknown') updateFields.name = name;
                if (sector) updateFields.sector = sector;
                else if (integration.defaultSector) updateFields.sector = integration.defaultSector;
                
                if (source) updateFields.source = source;
                else if (integration.defaultSource) updateFields.source = integration.defaultSource;

                if (integration.assignedTo) updateFields.assignedTo = integration.assignedTo;
                
                const cfObj = {};
                if (contact.customFields) {
                  for (const [k, v] of contact.customFields.entries()) cfObj[k] = v;
                }
                
                let hasCfUpdate = false;
                for (const [k, v] of Object.entries(customFields)) {
                   if (cfObj[k] !== String(v)) {
                     updateFields[`customFields.${k}`] = String(v);
                     hasCfUpdate = true;
                   }
                }
                if (email && cfObj.email !== String(email)) {
                   updateFields['customFields.email'] = String(email);
                   hasCfUpdate = true;
                }

                const msgTag = `sheet_msg_${integration._id}`;
                const hasBeenMessaged = contact.tags && contact.tags.includes(msgTag);
                
                let addToSetFields = null;
                if (!hasBeenMessaged && integration.whatsappAccountId && integration.templatePreset) {
                   newContactsToMessage.push({ phone, name });
                   addToSetFields = { tags: msgTag };
                }

                if (Object.keys(updateFields).length > 0 || addToSetFields) {
                  const updateDoc = {};
                  if (Object.keys(updateFields).length > 0) updateDoc.$set = updateFields;
                  if (addToSetFields) updateDoc.$addToSet = addToSetFields;

                  bulkOps.push({
                    updateOne: {
                      filter: { phone },
                      update: updateDoc
                    }
                  });
                  localUpdated++;
                }
              } else {
                bulkOps.push({
                  insertOne: {
                    document: {
                      name,
                      phone,
                      sector: integration.defaultSector || sector || 'Unassigned',
                      source: integration.defaultSource || source || 'Google Sheets Auto-Sync',
                      tags: [integration.importTag, `sheet_msg_${integration._id}`],
                      customFields: { ...customFields, ...(email ? { email } : {}) },
                      whatsappAccountId: integration.whatsappAccountId,
                      assignedTo: integration.assignedTo || null
                    }
                  }
                });
                localAdded++;
                if (integration.whatsappAccountId && integration.templatePreset) {
                   newContactsToMessage.push({ phone, name });
                }
              }
              
              // Add to Conversation bulk operations for this specific row's assignedTo/sector/source
              const rowConvUpdates = {};
              if (integration.assignedTo) rowConvUpdates.assignedTo = integration.assignedTo;
              
              const finalSector = integration.defaultSector || sector;
              if (finalSector && finalSector !== 'Unassigned') rowConvUpdates.sector = finalSector;
              
              const finalSource = integration.defaultSource || source;
              if (finalSource && finalSource !== 'Unassigned' && finalSource !== 'Google Sheets Auto-Sync') rowConvUpdates.source = finalSource;
              
              if (Object.keys(rowConvUpdates).length > 0) {
                convBulkOps.push({
                  updateOne: {
                    filter: { phone },
                    update: { $set: rowConvUpdates }
                  }
                });
              }
            }
            
            if (bulkOps.length > 0) {
               await Contact.bulkWrite(bulkOps, { ordered: false });
            }
            if (convBulkOps.length > 0) {
               await Conversation.bulkWrite(convBulkOps, { ordered: false });
            }
            
            if (newContactsToMessage.length > 0 && integration.whatsappAccountId && integration.templatePreset) {
              const account = integration.whatsappAccountId;
              const preset = integration.templatePreset;
              for (const contact of newContactsToMessage) {
                await sendAutoMessage(account, contact.phone, contact.name, preset);
              }
            }
            
            return { added: localAdded, updated: localUpdated };
          })());
        }
        
        const results = await Promise.all(chunkPromises);
        for (const res of results) {
           addedCount += res.added;
           updatedCount += res.updated;
        }
        
        integration.lastSyncedAt = new Date();
        integration.syncStats = {
          totalAdded: (integration.syncStats?.totalAdded || 0) + addedCount,
          totalUpdated: (integration.syncStats?.totalUpdated || 0) + updatedCount
        };
        await integration.save();
      } catch (sheetErr) {
        console.error(`Error syncing sheet ${integration.spreadsheetId}:`, sheetErr.message);
      }
    }
  } catch (err) {
    console.error('Google Sheets Sync Engine Error:', err);
  }
};
