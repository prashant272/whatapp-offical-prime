import WhatsAppAccount from "../models/WhatsAppAccount.js";

export const attachWhatsAppAccount = async (req, res, next) => {
  const accountId = req.headers["x-whatsapp-account-id"];
  
  if (accountId) {
    console.log(`🔍 Received Account ID Header: "${accountId}"`);
    const account = await WhatsAppAccount.findById(accountId).catch(() => null);
    if (account) {
      console.log(`✅ Found Account: ${account.name}`);
      req.whatsappAccount = account;
    } else {
      console.log(`❌ Account NOT Found for ID: ${accountId}`);
    }
  }

  // Fallback to default account if none provided
  if (!req.whatsappAccount) {
    const defaultAccount = await WhatsAppAccount.findOne({ isDefault: true }) || await WhatsAppAccount.findOne();
    if (defaultAccount) {
      req.whatsappAccount = defaultAccount;
    }
  }

  if (req.whatsappAccount) {
    // Log only in dev or if needed, but remove for now to keep terminal clean
  }

  next();
};
