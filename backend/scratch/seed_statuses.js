import mongoose from "mongoose";
import dotenv from "dotenv";
import StatusOption from "../models/StatusOption.js";
dotenv.config();

const seedStatuses = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🚀 Connected to DB.");
    
    const defaults = [
      { name: "New", color: "#3498db" },
      { name: "Interested", color: "#25d366" },
      { name: "Not Interested", color: "#ff4757" },
      { name: "Follow-up", color: "#f1c40f" },
      { name: "Closed", color: "#94a3b8" }
    ];

    for (const s of defaults) {
      await StatusOption.findOneAndUpdate(
        { name: s.name },
        { $setOnInsert: s },
        { upsert: true, new: true }
      );
    }
    
    console.log("✅ Default statuses seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

seedStatuses();
