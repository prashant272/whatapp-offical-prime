import EmailSetting from "../models/EmailSetting.js";
import EmailTemplate from "../models/EmailTemplate.js";
import EmailLog from "../models/EmailLog.js";
import EmailInbox from "../models/EmailInbox.js";
import { verifySmtpConnection, sendEmail } from "../services/emailService.js";
import { syncUserInbox } from "../services/imapSyncService.js";
import { logActivity } from "../utils/activityLogger.js";

// --- SMTP CONFIGURATIONS (CRUD) ---

export const getEmailSettings = async (req, res) => {
  try {
    const userRef = req.user._id;
    const settings = await EmailSetting.find({ userRef }).sort({ name: 1 });
    
    // Mask passwords before returning
    const safeSettings = settings.map(s => {
      const obj = s.toObject();
      if (obj.pass) {
        obj.pass = "••••••••••••";
      }
      return obj;
    });
    res.json(safeSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const saveEmailSettings = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { id, name, type, host, port, secure, user, pass, senderName, senderEmail, imapHost, imapPort, imapSecure } = req.body;

    if (!name || !type || !user || !pass) {
      return res.status(400).json({ error: "Missing required fields (name, type, user, pass)" });
    }

    let setting;
    if (id) {
      // Edit existing
      setting = await EmailSetting.findOne({ _id: id, userRef });
      if (!setting) {
        return res.status(404).json({ error: "SMTP profile not found" });
      }
    } else {
      // Create new - check name uniqueness per user
      const existing = await EmailSetting.findOne({ userRef, name });
      if (existing) {
        return res.status(400).json({ error: `An SMTP profile with the name '${name}' already exists.` });
      }
      setting = new EmailSetting({ userRef });
    }
    
    let updatedPass = pass;
    if (id && pass === "••••••••••••") {
      updatedPass = setting.pass;
    }

    setting.name = name;
    setting.type = type;
    setting.host = host;
    setting.port = port;
    setting.secure = secure;
    setting.user = user;
    setting.pass = updatedPass;
    setting.senderName = senderName;
    setting.senderEmail = senderEmail;
    setting.imapHost = imapHost;
    setting.imapPort = imapPort;
    setting.imapSecure = imapSecure;

    await setting.save();
    
    await logActivity(req.user._id, "SAVE_EMAIL_SETTINGS", `${id ? "Updated" : "Created"} SMTP profile: ${name}`, name);

    res.json({ message: "SMTP Profile saved successfully", profile: setting });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteEmailSetting = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { id } = req.params;
    const setting = await EmailSetting.findOneAndDelete({ _id: id, userRef });

    if (setting) {
      await logActivity(userRef, "DELETE_EMAIL_SETTING", `Deleted SMTP profile: ${setting.name}`, setting.name);
    }

    res.json({ message: "SMTP Profile deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const testSmtpConnection = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { id, type, host, port, secure, user, pass, senderName, senderEmail } = req.body;
    
    let settingToTest;
    if (id && pass === "••••••••••••") {
      const existing = await EmailSetting.findOne({ _id: id, userRef });
      if (!existing) {
        return res.status(404).json({ error: "SMTP profile not found" });
      }
      settingToTest = existing;
    } else {
      settingToTest = new EmailSetting({ userRef, type, host, port, secure, user, pass, senderName, senderEmail });
    }

    await verifySmtpConnection(settingToTest);
    res.json({ success: true, message: `Successfully connected to SMTP server!` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// --- SEND EMAIL ---

export const sendEmailOutbound = async (req, res) => {
  const userRef = req.user._id;
  const { smtpProfileId, to, subject, body } = req.body;

  if (!smtpProfileId || !to || !subject || !body) {
    return res.status(400).json({ error: "Missing required fields (smtpProfileId, to, subject, body)" });
  }

  let setting;
  try {
    setting = await EmailSetting.findOne({ _id: smtpProfileId, userRef });
    if (!setting) {
      return res.status(404).json({ error: "Selected SMTP Profile not found." });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const attachments = req.files ? req.files.map(file => ({
    filename: file.originalname,
    content: file.buffer,
    contentType: file.mimetype
  })) : [];

  const attachmentNames = req.files ? req.files.map(file => file.originalname) : [];

  try {
    // Send email
    await sendEmail(setting, {
      to,
      subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ""),
      attachments
    });

    // Save success log
    const profileName = setting.name || (setting.type === "gmail" ? "Gmail SMTP" : "Official SMTP");
    await EmailLog.create({
      userRef,
      smtpProfileName: profileName,
      to,
      subject,
      body,
      status: "success",
      attachments: attachmentNames
    });

    await logActivity(userRef, "SEND_EMAIL", `Sent email to ${to} using SMTP profile ${profileName}`, to);

    res.json({ success: true, message: "Email sent successfully!" });
  } catch (err) {
    const profileName = setting ? (setting.name || (setting.type === "gmail" ? "Gmail SMTP" : "Official SMTP")) : "Unknown SMTP";
    // Save failed log
    await EmailLog.create({
      userRef,
      smtpProfileName: profileName,
      to,
      subject,
      body,
      status: "failed",
      attachments: attachmentNames,
      errorMessage: err.message
    });

    res.status(500).json({ error: err.message });
  }
};

// --- TEMPLATES ---

export const getTemplates = async (req, res) => {
  try {
    const userRef = req.user._id;
    const templates = await EmailTemplate.find({ userRef }).sort({ name: 1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { name, subject, body } = req.body;
    const template = new EmailTemplate({ userRef, name, subject, body });
    await template.save();

    await logActivity(userRef, "CREATE_EMAIL_TEMPLATE", `Created template: ${name}`, name);

    res.json(template);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { id } = req.params;
    const { name, subject, body } = req.body;

    const template = await EmailTemplate.findOne({ _id: id, userRef });
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (name !== undefined) template.name = name;
    if (subject !== undefined) template.subject = subject;
    if (body !== undefined) template.body = body;

    await template.save();

    await logActivity(userRef, "UPDATE_EMAIL_TEMPLATE", `Updated template: ${template.name}`, template.name);

    res.json(template);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { id } = req.params;
    const template = await EmailTemplate.findOneAndDelete({ _id: id, userRef });

    if (template) {
      await logActivity(userRef, "DELETE_EMAIL_TEMPLATE", `Deleted template: ${template.name}`, template.name);
    }

    res.json({ message: "Template deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- EMAIL LOGS / HISTORY ---

export const getEmailLogs = async (req, res) => {
  try {
    const userRef = req.user._id;
    const logs = await EmailLog.find({ userRef }).sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- EMAIL INBOX / REPLIES ---

export const getEmailInbox = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { sync } = req.query;

    if (sync === "true") {
      await syncUserInbox(userRef);
    }

    const inbox = await EmailInbox.find({ userRef })
      .populate("smtpProfileId", "name user type")
      .sort({ date: -1 })
      .limit(100);
    res.json(inbox);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const markEmailAsRead = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { id } = req.params;
    const { seen } = req.body;

    const email = await EmailInbox.findOneAndUpdate(
      { _id: id, userRef },
      { seen: seen !== undefined ? seen : true },
      { new: true }
    );

    if (!email) {
      return res.status(404).json({ error: "Email not found" });
    }

    res.json({ success: true, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteInboxEmail = async (req, res) => {
  try {
    const userRef = req.user._id;
    const { id } = req.params;

    const email = await EmailInbox.findOneAndDelete({ _id: id, userRef });
    if (!email) {
      return res.status(404).json({ error: "Email not found" });
    }

    res.json({ success: true, message: "Email deleted from inbox" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
