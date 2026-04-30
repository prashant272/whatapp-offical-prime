import Campaign from "../models/Campaign.js";

/**
 * Sequential throttler for WhatsApp Campaigns
 */
export const throttleCampaign = async (account, contacts, templateName, sendFunction, onProgress, templateComponents = [], language = "en_US", delayInSeconds, campaignId) => {
  let successCount = 0;
  let failureCount = 0;
  const logs = [];

  for (const contact of contacts) {
    // --- STATUS & TIME WINDOW CHECK ---
    if (campaignId) {
      let shouldContinue = false;
      while (!shouldContinue) {
        const campaign = await Campaign.findById(campaignId);
        
        // If campaign was deleted or stopped externally
        if (!campaign || ["COMPLETED", "FAILED"].includes(campaign.status)) {
          return { successCount, failureCount, logs };
        }

        // Handle Manual Pause
        if (campaign.status === "PAUSED") {
          console.log(`⏸️ Campaign "${campaign.name}" is PAUSED manually. Waiting...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        // Handle Time Window (8 AM - 7 PM)
        const now = new Date();
        const hours = now.getHours();
        const isOutsideWindow = hours < 8 || hours >= 19;

        if (isOutsideWindow && !campaign.allowOutsideHours) {
          console.log(`🌙 Outside business hours (8AM-7PM) for campaign "${campaign.name}". Waiting...`);
          // We wait 1 minute before checking again
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;
        }

        shouldContinue = true;
      }
    }

    try {
      // Use user-defined delay or add a small random delay (1-3s) to mimic human behavior
      const delayMs = delayInSeconds !== undefined && delayInSeconds !== null && delayInSeconds !== "" 
        ? Number(delayInSeconds) * 1000 
        : Math.floor(Math.random() * 2000) + 1000;
        
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // Pass the account object as the first argument
      const res = await sendFunction(account, contact.phone, templateName, language, templateComponents);
      const messageId = res.messages?.[0]?.id;
      
      successCount++;
      logs.push({ phone: contact.phone, status: "sent", messageId, sentAt: new Date() });
    } catch (error) {
      failureCount++;
      // Meta API Errors are nested in response.data.error
      const metaError = error.response?.data?.error?.message;
      const errorMessage = metaError || error.message || "Unknown error";
      
      logs.push({ phone: contact.phone, status: "failed", error: errorMessage, sentAt: new Date() });
      console.error(`❌ Meta API Reject for ${contact.phone}:`, errorMessage);
    }

    if (onProgress) {
      // We refetch to get the latest counts from other potential parallel operations if any, 
      // but here we just pass our local counts.
      await onProgress(successCount, failureCount, logs, logs[logs.length - 1]);
    }
  }

  return { successCount, failureCount, logs };
};
