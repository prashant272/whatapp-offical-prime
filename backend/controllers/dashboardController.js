import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Campaign from "../models/Campaign.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";
import Contact from "../models/Contact.js";

// GET /api/dashboard/stats
// Optimized: uses aggregation pipelines instead of N×countDocuments calls
export const getDashboardStats = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Run all heavy queries in parallel — only 6 DB round trips total
    const [
      accounts,
      msgAggResult,
      dailyRaw,
      campaignAgg,
      contactCount,
      convAgg,
    ] = await Promise.all([

      // 1. Accounts list
      WhatsAppAccount.find({}, "name phoneNumber phoneNumberId isActive").lean(),

      // 2. ALL message stats in ONE aggregation pass (overall + per account)
      Message.aggregate([
        {
          $group: {
            _id: {
              accountId: "$whatsappAccountId",
              direction: "$direction",
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 3. Daily 7-day chart
      Message.aggregate([
        { $match: { timestamp: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "+05:30" } },
              direction: "$direction",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),

      // 4. Campaign counts in one aggregation
      Campaign.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $in: ["$status", ["RUNNING", "PENDING"]] }, 1, 0] },
            },
          },
        },
      ]),

      // 5. Contact count
      Contact.estimatedDocumentCount(),

      // 6. Conversation stats in one aggregation
      Conversation.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // ── Process message aggregation ──────────────────────────────────────
    // Build per-account buckets and global totals from single aggregate result
    const globalBucket = { sent: 0, delivered: 0, read: 0, replies: 0, failed: 0 };
    const accountBuckets = {}; // keyed by accountId string

    for (const row of msgAggResult) {
      const accId = row._id.accountId?.toString() || "__none__";
      if (!accountBuckets[accId]) {
        accountBuckets[accId] = { sent: 0, delivered: 0, read: 0, replies: 0, failed: 0 };
      }
      const b = accountBuckets[accId];
      const { direction, status } = row._id;
      const n = row.count;

      if (direction === "inbound") {
        b.replies += n;
        globalBucket.replies += n;
      } else {
        // outbound
        b.sent += n;
        globalBucket.sent += n;
        if (status === "delivered" || status === "read") {
          b.delivered += n;
          globalBucket.delivered += n;
        }
        if (status === "read") {
          b.read += n;
          globalBucket.read += n;
        }
        if (status === "failed") {
          b.failed += n;
          globalBucket.failed += n;
        }
      }
    }

    // Build per-account breakdown array
    const accountBreakdown = accounts.map((acc) => {
      const b = accountBuckets[acc._id.toString()] || { sent: 0, delivered: 0, read: 0, replies: 0, failed: 0 };
      return {
        accountId: acc._id,
        accountName: acc.name,
        phoneNumber: acc.phoneNumber || acc.phoneNumberId,
        isActive: acc.isActive,
        ...b,
        deliveryRate: b.sent > 0 ? ((b.delivered / b.sent) * 100).toFixed(1) : "0.0",
        readRate:     b.sent > 0 ? ((b.read     / b.sent) * 100).toFixed(1) : "0.0",
        replyRate:    b.sent > 0 ? ((b.replies  / b.sent) * 100).toFixed(1) : "0.0",
      };
    });

    const { sent: ts, delivered: td, read: tr, replies: trp, failed: tf } = globalBucket;

    // ── Process daily chart ──────────────────────────────────────────────
    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { date: key, sent: 0, received: 0 };
    }
    for (const r of dailyRaw) {
      const key = r._id.date;
      if (dailyMap[key]) {
        if (r._id.direction === "outbound") dailyMap[key].sent += r.count;
        if (r._id.direction === "inbound")  dailyMap[key].received += r.count;
      }
    }
    const dailyChart = Object.values(dailyMap);

    // ── Campaign & conversation totals ───────────────────────────────────
    const campData  = campaignAgg[0] || { total: 0, active: 0 };
    const statusBreakdown = convAgg.map(s => ({ status: s._id || "Unknown", count: s.count }));
    const totalConv = statusBreakdown.reduce((a, b) => a + b.count, 0);
    const openConv  = convAgg
      .filter(s => !["Closed", "Resolved"].includes(s._id))
      .reduce((a, b) => a + b.count, 0);

    res.json({
      overall: {
        sent: ts,
        delivered: td,
        read: tr,
        replies: trp,
        failed: tf,
        deliveryRate: ts > 0 ? ((td  / ts) * 100).toFixed(1) : "0.0",
        readRate:     ts > 0 ? ((tr  / ts) * 100).toFixed(1) : "0.0",
        replyRate:    ts > 0 ? ((trp / ts) * 100).toFixed(1) : "0.0",
      },
      accounts: accountBreakdown,
      dailyChart,
      campaigns: { total: campData.total, active: campData.active },
      contacts:  { total: contactCount },
      conversations: { total: totalConv, open: openConv, statusBreakdown },
    });

  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};
