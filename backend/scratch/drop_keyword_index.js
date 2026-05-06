import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const dropIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    
    const collection = mongoose.connection.collection("keywordrules");
    await collection.dropIndex("keyword_1");
    console.log("Successfully dropped unique index on 'keyword'");
    
    process.exit(0);
  } catch (err) {
    console.error("Error dropping index:", err.message);
    process.exit(1);
  }
};

dropIndex();
