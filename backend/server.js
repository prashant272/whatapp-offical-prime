import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// Route Imports
import templateRoutes from "./routes/templateRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import presetRoutes from "./routes/presetRoutes.js";
import { errorHandler } from "./utils/errorHandler.js";

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- ROUTES ---

// 1. Templates
app.use("/api/templates", templateRoutes);

// 2. Campaigns
app.use("/api/campaigns", campaignRoutes);

// 3. Webhooks
app.use("/webhook", webhookRoutes);

// 4. Chat & Messages
app.use("/api", chatRoutes); // /api/conversations, /api/messages/...

// 5. Contacts & Uploads
app.use("/api/contacts", contactRoutes);
app.use("/api/upload", uploadRoutes);

// --- ROUTES ---

// 1. Root Status Check (Health Check)
app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "WhatsApp Dashboard API is Running",
    status: "UP", 
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// 2. Auth & User Management
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// 7. Activity Logs
app.use("/api/activities", activityRoutes);

// 8. Template Presets
app.use("/api/presets", presetRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT} 🚀`));
