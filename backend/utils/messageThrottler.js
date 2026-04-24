/**
 * Simple throttler to send messages sequentially with a delay
 */
export const throttleCampaign = async (contacts, templateName, sendFunction, onProgress, templateComponents = [], language = "en_US") => {
  let successCount = 0;
  let failureCount = 0;
  const logs = [];

  for (const contact of contacts) {
    try {
      // Add a small random delay between 1-3 seconds to mimic human behavior and avoid bans
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      const res = await sendFunction(contact.phone, templateName, language, templateComponents);
      const messageId = res.messages?.[0]?.id;
      
      successCount++;
      logs.push({ phone: contact.phone, status: "sent", messageId });
    } catch (error) {
      failureCount++;
      logs.push({ phone: contact.phone, status: "failed", error: error.message || "Unknown error" });
      console.error(`Failed to send to ${contact.phone}:`, error);
    }

    if (onProgress) {
      await onProgress(successCount, failureCount, logs, logs[logs.length - 1]);
    }
  }

  return { successCount, failureCount, logs };
};
