import { verifyContacts } from "../services/whatsappService.js";

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
