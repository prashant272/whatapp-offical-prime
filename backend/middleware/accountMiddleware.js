import WhatsAppAccount from "../models/WhatsAppAccount.js";

export const attachWhatsAppAccount = async (req, res, next) => {
  const accountIdHeader = req.headers["x-whatsapp-account-id"];
  
  if (accountIdHeader) {
    // Support multiple IDs (comma separated)
    if (accountIdHeader.includes(",")) {
      const ids = accountIdHeader.split(",").filter(id => id.trim());
      req.whatsappAccountIds = ids;
      
      const accounts = await WhatsAppAccount.find({ _id: { $in: ids } });
      if (accounts.length > 0) {
        req.whatsappAccount = accounts[0]; // Set first as primary for context
        req.includesDefaultAccount = accounts.some(acc => acc.isDefault);
      }
    } else {
      const account = await WhatsAppAccount.findById(accountIdHeader).catch(() => null);
      if (account) {
        req.whatsappAccount = account;
        req.whatsappAccountIds = [accountIdHeader];
        req.includesDefaultAccount = account.isDefault;
      }
    }
  }

  // Fallback to default account if none provided
  if (!req.whatsappAccount) {
    const defaultAccount = await WhatsAppAccount.findOne({ isDefault: true }) || await WhatsAppAccount.findOne();
    if (defaultAccount) {
      req.whatsappAccount = defaultAccount;
      req.whatsappAccountIds = [defaultAccount._id.toString()];
    }
  }

  next();
};
