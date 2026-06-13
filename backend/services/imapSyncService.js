import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import EmailInbox from "../models/EmailInbox.js";
import EmailSetting from "../models/EmailSetting.js";
import { smartEmit } from "../utils/socket.js";

/**
 * Syncs email inbox for a given EmailSetting profile.
 * @param {Object} profile - Mongoose model instance of EmailSetting
 */
export const syncProfileInbox = async (profile) => {
  const profileName = profile.name || profile.user || "Unnamed Profile";
  const host = profile.imapHost || (profile.type === "gmail" ? "imap.gmail.com" : "");
  const port = profile.imapPort || (profile.type === "gmail" ? 993 : 143);
  const secure = profile.imapSecure !== undefined ? profile.imapSecure : (profile.type === "gmail" ? true : false);

  if (!host) {
    console.log(`⚠️ Skip sync for profile ${profileName}: IMAP Host not configured.`);
    return;
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: {
      user: profile.user,
      pass: profile.pass,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    
    // Select INBOX
    let lock = await client.getMailboxLock("INBOX");
    try {
      // Find the most recent email date synced in our database for this profile
      const lastEmail = await EmailInbox.findOne({ smtpProfileId: profile._id }).sort({ date: -1 });
      let sinceDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // Default 3 days ago
      if (lastEmail && lastEmail.date) {
        // Search since the last email date minus a 1-hour buffer to avoid time overlaps or clock drift issues
        sinceDate = new Date(lastEmail.date.getTime() - 60 * 60 * 1000);
      }

      const searchCriteria = {
        since: sinceDate
      };

      // Get UIDs matching criteria
      let messages = await client.search(searchCriteria);
      
      if (messages && messages.length > 0) {
        // Sort newest first
        messages.reverse();
        // Sync up to 50 latest matching emails
        const limitedMessages = messages.slice(0, 50);

        for (const uid of limitedMessages) {
          let messageData = await client.fetchOne(uid, { envelope: true, uid: true });
          if (!messageData) continue;

          const messageId = messageData.envelope.messageId;
          if (!messageId) continue;

          // Check if messageId already exists in our db
          const exists = await EmailInbox.findOne({ messageId });
          if (exists) {
            continue;
          }

          // Fetch full raw source to parse body
          let sourceObj = await client.fetchOne(uid, { source: true });
          if (!sourceObj || !sourceObj.source) continue;

          // Parse raw MIME source
          const parsed = await simpleParser(sourceObj.source);

          const fromAddr = parsed.from && parsed.from.value && parsed.from.value[0] ? parsed.from.value[0].address : "unknown";
          const fromName = parsed.from && parsed.from.value && parsed.from.value[0] ? parsed.from.value[0].name : "";
          const toAddr = parsed.to && parsed.to.value && parsed.to.value[0] ? parsed.to.value[0].address : profile.user;

          // Create database record
          const newEmail = await EmailInbox.create({
            userRef: profile.userRef,
            smtpProfileId: profile._id,
            messageId: messageId,
            from: fromAddr,
            fromName: fromName,
            to: toAddr,
            subject: parsed.subject || "(No Subject)",
            bodyHtml: parsed.html || parsed.textAsHtml || "",
            bodyText: parsed.text || "",
            date: parsed.date || new Date(),
            seen: false,
            uid: uid
          });

          // Emit real-time notification
          smartEmit("new_email", { email: newEmail });
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error(`❌ IMAP Sync Error for profile ${profileName}:`, err.message);
    try {
      await client.logout();
    } catch (_) {}
    throw err;
  }
};

/**
 * Syncs all active profile inboxes for a given user.
 * @param {String} userRef - User ID
 */
export const syncUserInbox = async (userRef) => {
  const profiles = await EmailSetting.find({ userRef });
  let count = 0;
  for (const profile of profiles) {
    try {
      await syncProfileInbox(profile);
      count++;
    } catch (err) {
      console.error(`Failed to sync inbox for profile ${profile.name}:`, err.message);
    }
  }
  return count;
};
