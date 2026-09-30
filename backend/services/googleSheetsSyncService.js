import { google } from 'googleapis';
import User from '../models/User.js';
import SheetIntegration from '../models/SheetIntegration.js';
import Contact from '../models/Contact.js';

const getOauth2Client = () => {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
};

export const syncGoogleSheets = async () => {
  try {
    const integrations = await SheetIntegration.find({ active: true });
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

        if (phoneIdx === -1) {
           console.log('Skipping sheet because phoneIdx is -1');
           continue;
        }

        let addedCount = 0;
        let updatedCount = 0;

        const validRows = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rawPhone = row[phoneIdx];
          if (!rawPhone) continue;
          
          let phone = String(rawPhone).replace(/[^0-9]/g, '');
          if (phone.length === 10) phone = '91' + phone;
          if (phone.length < 10) continue;

          validRows.push({ row, phone });
        }

        const BATCH_SIZE = 5000;
        const chunkPromises = [];

        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          
          chunkPromises.push((async () => {
            let localAdded = 0;
            let localUpdated = 0;
            
            const batchPhones = batch.map(b => b.phone);
            const existingContacts = await Contact.find({ phone: { $in: batchPhones } });
            const contactMap = new Map();
            for (const c of existingContacts) contactMap.set(c.phone, c);

            const bulkOps = [];
            
            for (const item of batch) {
              const { row, phone } = item;
              const name = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : 'Unknown';
              const email = emailIdx !== -1 ? row[emailIdx] : null;
              const sector = sectorIdx !== -1 ? row[sectorIdx] : null;

              let customFields = {};
              for (const [key, value] of Object.entries(fieldMapping)) {
                if (key.startsWith('customFields.')) {
                  const cfName = key.replace('customFields.', '');
                  const cfIdx = headers.findIndex(h => h === value);
                  if (cfIdx !== -1 && row[cfIdx]) customFields[cfName] = row[cfIdx];
                }
              }
              
              headers.forEach((header, index) => {
                 if (index !== phoneIdx && index !== nameIdx && index !== emailIdx && index !== sectorIdx) {
                    if (row[index] && !Object.values(fieldMapping).includes(header)) {
                       customFields[header] = row[index];
                    }
                 }
              });

              const contact = contactMap.get(phone);
              if (contact) {
                let updateFields = {};
                if (name && name !== 'Unknown' && contact.name === 'Unknown') updateFields.name = name;
                if (sector && (!contact.sector || contact.sector === 'Unassigned')) updateFields.sector = sector;
                
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

                if (Object.keys(updateFields).length > 0) {
                  bulkOps.push({
                    updateOne: {
                      filter: { phone },
                      update: { $set: updateFields }
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
                      sector: sector || 'Unassigned',
                      source: 'Google Sheets Auto-Sync',
                      tags: [integration.importTag],
                      customFields: { ...customFields, ...(email ? { email } : {}) },
                      whatsappAccountId: integration.whatsappAccountId
                    }
                  }
                });
                localAdded++;
              }
            }
            
            if (bulkOps.length > 0) {
               await Contact.bulkWrite(bulkOps, { ordered: false });
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
