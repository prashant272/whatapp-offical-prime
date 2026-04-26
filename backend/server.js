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
import autoReplyRoutes from "./routes/autoReplyRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import { errorHandler } from "./utils/errorHandler.js";

import { createServer } from "http";
import { initSocket } from "./utils/socket.js";

dotenv.config();
connectDB();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Middleware
app.use(cors());
app.use(express.json());

// --- ROUTES ---
// ... (omitted routes for brevity, assuming replace_file_content handles the whole block)
app.use("/api/templates", templateRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/webhook", webhookRoutes);
app.use("/api", chatRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/presets", presetRoutes);
app.use("/api/auto-replies", autoReplyRoutes);
app.use("/api/media", mediaRoutes);

app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "WhatsApp Dashboard API is Running",
    status: "UP", 
    timestamp: new Date()
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Backend running on port ${PORT} 🚀`));
