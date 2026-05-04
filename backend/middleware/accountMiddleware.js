import WhatsAppAccount from "../models/WhatsAppAccount.js";

export const attachWhatsAppAccount = async (req, res, next) => {
  const accountId = req.headers["x-whatsapp-account-id"];
  
  if (accountId) {
    if (accountId === "all") {
      req.whatsappAccount = { _id: "all", name: "All Accounts", isAll: true };
      return next();
    }
    const account = await WhatsAppAccount.findById(accountId).catch(() => null);
    if (account) {
      req.whatsappAccount = account;
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
