import WhatsAppAccount from "../models/WhatsAppAccount.js";

export const syncEnvAccount = async () => {
  try {
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    if (!phoneNumberId) return;

    // Only create from .env if NO WhatsApp account exists in DB at all.
    // Never overwrite existing accounts on server restart so UI edits are preserved.
    const existingCount = await WhatsAppAccount.countDocuments();
    if (existingCount === 0) {
      const account = await WhatsAppAccount.create({
        name: "Primary Number",
        phoneNumberId: process.env.PHONE_NUMBER_ID,
        wabaId: process.env.WABA_ID,
        accessToken: process.env.ACCESS_TOKEN,
        isDefault: true
      });
      console.log(`✅ Initialized primary account from .env (WABA: ${account.wabaId})`);
    } else {
      console.log(`ℹ️ WhatsApp accounts already present in DB (${existingCount} accounts). Skipping .env overwrite.`);
    }
  } catch (error) {
    console.error("❌ Error in Account Sync:", error.message);
  }
};
