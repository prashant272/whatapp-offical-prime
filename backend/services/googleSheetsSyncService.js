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
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: integration.spreadsheetId,
          range: `${integration.sheetName}!A:Z`,
          valueRenderOption: 'UNFORMATTED_VALUE'
        });

        const rows = response.data.values;
        console.log(`Fetched ${rows?.length} rows from sheet`);
        if (!rows || rows.length <= 1) continue;

        const headers = rows[0];
        const fieldMapping = integration.fieldMapping || {};
        
        // Find indices based on mapping or fallback
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

        console.log("Sheet Headers:", headers);
        console.log("Field Mapping:", fieldMapping);
        console.log("PhoneIdx:", phoneIdx, "NameIdx:", nameIdx);

        if (phoneIdx === -1) {
           console.log("Skipping sheet because phoneIdx is -1");
           continue;
        }

        let addedCount = 0;
        let updatedCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rawPhone = row[phoneIdx];
          console.log(`Row ${i} Raw Phone:`, rawPhone);
          if (!rawPhone) continue;
          
          const phone = String(rawPhone).replace(/[^0-9]/g, '');
          console.log(`Row ${i} Parsed Phone:`, phone);
          if (phone.length < 10) continue;

          const name = nameIdx !== -1 ? row[nameIdx] : 'Unknown';
          const email = emailIdx !== -1 ? row[emailIdx] : null;
          const sector = sectorIdx !== -1 ? row[sectorIdx] : null;

          let customFields = {};
          // Custom field mappings
          for (const [key, value] of Object.entries(fieldMapping)) {
            if (key.startsWith('customFields.')) {
              const cfName = key.replace('customFields.', '');
              const cfIdx = headers.findIndex(h => h === value);
              if (cfIdx !== -1 && row[cfIdx]) {
                customFields[cfName] = row[cfIdx];
              }
            }
          }
          
          // Unmapped headers become custom fields
          headers.forEach((header, index) => {
             if (index !== phoneIdx && index !== nameIdx && index !== emailIdx && index !== sectorIdx) {
                if (row[index] && !Object.values(fieldMapping).includes(header)) {
                   customFields[header] = row[index];
                }
             }
          });

          let contact = await Contact.findOne({ phone });
          if (contact) {
            let updated = false;
            if (name && name !== 'Unknown' && contact.name === 'Unknown') {
              contact.name = name; updated = true;
            }
            if (sector && !contact.sector) {
              contact.sector = sector; updated = true;
            }
            if (Object.keys(customFields).length > 0 || email) {
               if (!contact.customFields) contact.customFields = new Map();
               for (const [k, v] of Object.entries(customFields)) {
                 if (contact.customFields.get(k) !== String(v)) {
                   contact.customFields.set(k, String(v));
                   updated = true;
                 }
               }
               if (email && contact.customFields.get('email') !== String(email)) {
                 contact.customFields.set('email', String(email));
                 updated = true;
               }
            }
            if (updated) {
              await contact.save();
              updatedCount++;
            }
          } else {
            await Contact.create({
              name: name || 'Unknown',
              phone,
              sector,
              source: 'Google Sheets Auto-Sync',
              tags: [integration.importTag],
              customFields: { ...customFields, email },
              whatsappAccountId: integration.whatsappAccountId
            });
            addedCount++;
          }
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
