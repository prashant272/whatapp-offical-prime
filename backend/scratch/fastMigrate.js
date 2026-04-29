import mongoose from "mongoose";
import dotenv from "dotenv";
import Contact from "../models/Contact.js";

dotenv.config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const PRIMARY_ID = "69ef020c6c021bd0911d62c2";
    
    console.log(`🚀 Bulk updating all contacts without Account ID to Primary (${PRIMARY_ID})...`);

    const result = await Contact.updateMany(
      { whatsappAccountId: null },
      { $set: { whatsappAccountId: PRIMARY_ID } }
    );

    console.log(`✅ Success! Updated ${result.modifiedCount} contacts.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
