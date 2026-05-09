import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Conversation from './backend/models/Conversation.js';

dotenv.config({ path: './backend/.env' });

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("🚀 Connected to MongoDB");

        const result = await Conversation.updateMany(
            { lastCustomerMessageAt: { $exists: false } },
            [
                { $set: { lastCustomerMessageAt: "$lastMessageTime" } }
            ]
        );

        console.log(`✅ Migration complete. Updated ${result.modifiedCount} conversations.`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

migrate();
