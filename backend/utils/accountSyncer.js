import WhatsAppAccount from "../models/WhatsAppAccount.js";

export const syncEnvAccount = async () => {
  try {
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    if (!phoneNumberId) return;

    // Use findOneAndUpdate to always keep the Primary Account in sync with .env
    const account = await WhatsAppAccount.findOneAndUpdate(
      { phoneNumberId },
      {
        name: "Primary Number",
        phoneNumberId: process.env.PHONE_NUMBER_ID,
        wabaId: process.env.WABA_ID,
        accessToken: process.env.ACCESS_TOKEN,
        isDefault: true
      },
      { upsert: true, new: true }
    );
    
    console.log(`✅ Synced primary account from .env (WABA: ${account.wabaId})`);
  } catch (error) {
    console.error("❌ Error in Account Sync:", error.message);
  }
};
