import mongoose from "mongoose";
import dotenv from "dotenv";
import Campaign from "../models/Campaign.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Contact from "../models/Contact.js";

dotenv.config({ path: "../.env" });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB for Sync...");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const syncHistory = async () => {
    await connectDB();

    console.log("🔍 Scanning all past campaigns...");
    const campaigns = await Campaign.find();
    
    let totalMessages = 0;
    let totalConversations = 0;

    for (const campaign of campaigns) {
        console.log(`Processing campaign: ${campaign.name}`);
        
        for (const log of campaign.logs) {
            if (log.status === "sent") {
                // Check if message already exists to avoid duplicates
                const existing = await Message.findOne({ to: log.phone, body: new RegExp(`Campaign \\[${campaign.name}\\]`) });
                
                if (!existing) {
                    // 1. Create Message
                    const msg = new Message({
                        from: "me",
                        to: log.phone,
                        body: `Campaign [${campaign.name}]: Previous Broadcast`,
                        direction: "outbound",
                        timestamp: log.sentAt
                    });
                    await msg.save();
                    totalMessages++;

                    // 2. Ensure Contact exists
                    let contact = await Contact.findOne({ phone: log.phone });
                    if (!contact) {
                        contact = new Contact({ name: `User ${log.phone}`, phone: log.phone });
                        await contact.save();
                    }

                    // 3. Update Conversation
                    await Conversation.findOneAndUpdate(
                        { phone: log.phone },
                        { 
                            contact: contact._id, 
                            lastMessage: msg.body, 
                            lastMessageTime: log.sentAt 
                        },
                        { upsert: true }
                    );
                    totalConversations++;
                }
            }
        }
    }

    console.log(`✅ SYNC COMPLETE!`);
    console.log(`Created ${totalMessages} historical messages.`);
    console.log(`Created/Updated ${totalConversations} conversations.`);
    process.exit(0);
};

syncHistory();
