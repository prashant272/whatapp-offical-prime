import mongoose from "mongoose";
import dotenv from "dotenv";
import Sector from "../models/Sector.js";
dotenv.config();

const seedSectors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🚀 Connected to DB.");
    
    const defaults = [
      { name: "Healthcare" },
      { name: "Education" },
      { name: "Business" },
      { name: "Astrology" }
    ];

    for (const s of defaults) {
      await Sector.findOneAndUpdate(
        { name: s.name },
        { $setOnInsert: s },
        { upsert: true, new: true }
      );
    }
    
    console.log("✅ Default sectors seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

seedSectors();
