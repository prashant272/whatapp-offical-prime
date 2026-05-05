import mongoose from "mongoose";
import dotenv from "dotenv";
import Campaign from "./models/Campaign.js";
import Message from "./models/Message.js";
import connectDB from "./config/db.js";

dotenv.config();

const syncCampaignsV2 = async () => {
  await connectDB();
  console.log("🚀 Starting Aggressive Campaign Data Sync...");

  // Check all campaigns from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const campaigns = await Campaign.find({ 
    createdAt: { $gte: sevenDaysAgo }
  });
  
  console.log(`Checking ${campaigns.length} recent campaigns.`);

  for (const campaign of campaigns) {
    let updated = false;
    let failedCount = 0;
    let sentCount = 0;
    let deliveredCount = 0;

    console.log(`\n-----------------------------------------`);
    console.log(`Processing: ${campaign.name} (${campaign.logs.length} logs)`);

    for (let i = 0; i < campaign.logs.length; i++) {
      const log = campaign.logs[i];
      const cleanPhone = log.phone.replace(/\D/g, "");
      const last10 = cleanPhone.slice(-10);

      // Find the most recent message for this phone around the campaign time
      const message = await Message.findOne({
        to: new RegExp(last10 + "$"),
        direction: "outbound",
        createdAt: { 
          $gte: new Date(new Date(log.sentAt).getTime() - 1000 * 60 * 60 * 12), // 12 hours window
          $lte: new Date(new Date(log.sentAt).getTime() + 1000 * 60 * 60 * 12)
        }
      }).sort({ createdAt: -1 });

      if (message) {
        // If chat status is failed, but log says sent/delivered
        if (message.status === "failed" && log.status !== "failed") {
          console.log(`❌ FIX: ${log.phone} -> FAILED (was ${log.status})`);
          campaign.logs[i].status = "failed";
          updated = true;
        } 
        // Also update delivered/read status if needed for accuracy
        else if (["delivered", "read"].includes(message.status) && log.status === "sent") {
          // console.log(`ℹ️ SYNC: ${log.phone} -> DELIVERED`);
          campaign.logs[i].status = "sent"; // We keep it as 'sent' in logs or we could add 'delivered'
          // If you want to show 'Delivered successfully' info
          updated = true;
        }
      }

      if (campaign.logs[i].status === "failed") failedCount++;
      else sentCount++;
    }

    if (updated) {
      campaign.failedCount = failedCount;
      campaign.sentCount = sentCount;
      await campaign.save();
      console.log(`✅ UPDATED: ${campaign.name} | Sent: ${sentCount} | Failed: ${failedCount}`);
    } else {
      console.log(`✨ Campaign "${campaign.name}" already matches Chat status.`);
    }
  }

  console.log("\n🏁 Sync completed.");
  process.exit(0);
};

syncCampaignsV2();
