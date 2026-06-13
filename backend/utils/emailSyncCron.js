import cron from "node-cron";
import EmailSetting from "../models/EmailSetting.js";
import { syncProfileInbox } from "../services/imapSyncService.js";

export const initEmailSyncCron = () => {
  // Run every 5 minutes automatically in the background
  cron.schedule("*/5 * * * *", async () => {
    console.log("⏰ Running Background Email Inbox IMAP Sync...");
    try {
      const allProfiles = await EmailSetting.find();
      for (const profile of allProfiles) {
        const profileName = profile.name || profile.user || "Unnamed Profile";
        try {
          await syncProfileInbox(profile);
          console.log(`✅ Synced inbox for profile: ${profileName}`);
        } catch (err) {
          console.error(`❌ Background sync failed for profile ${profileName}:`, err.message);
        }
      }
    } catch (err) {
      console.error("❌ Error running email sync cron:", err);
    }
  });
  console.log("📅 Email Inbox IMAP Sync Cron initialized.");
};
