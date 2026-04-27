/**
 * Sequential throttler for WhatsApp Campaigns
 */
export const throttleCampaign = async (account, contacts, templateName, sendFunction, onProgress, templateComponents = [], language = "en_US") => {
  let successCount = 0;
  let failureCount = 0;
  const logs = [];

  for (const contact of contacts) {
    try {
      // Add a small random delay (1-3s) to mimic human behavior
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Pass the account object as the first argument
      const res = await sendFunction(account, contact.phone, templateName, language, templateComponents);
      const messageId = res.messages?.[0]?.id;
      
      successCount++;
      logs.push({ phone: contact.phone, status: "sent", messageId });
    } catch (error) {
      failureCount++;
      const errorMessage = error.error?.message || error.message || "Unknown error";
      logs.push({ phone: contact.phone, status: "failed", error: errorMessage });
      console.error(`Failed to send to ${contact.phone}:`, error);
    }

    if (onProgress) {
      await onProgress(successCount, failureCount, logs, logs[logs.length - 1]);
    }
  }

  return { successCount, failureCount, logs };
};
