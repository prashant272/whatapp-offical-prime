import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const dropIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🚀 Connected to DB. Dropping old index...");
    
    const db = mongoose.connection.db;
    const collection = db.collection("templatepresets");
    
    // Drop the old unique name index
    await collection.dropIndex("name_1");
    console.log("✅ Old index 'name_1' dropped successfully.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error dropping index (it might not exist):", error.message);
    process.exit(1);
  }
};

dropIndex();
