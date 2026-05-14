import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage Engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "whatsapp_templates",
      resource_type: file.mimetype === "application/pdf" ? "raw" : "auto", // PDFs must be 'raw' to avoid 401 errors
      access_mode: "public", 
      type: "upload",        // Explicitly public upload
      allowed_formats: ["jpg", "png", "jpeg", "mp4", "pdf", "doc", "docx", "xls", "xlsx"],
      public_id: file.originalname.split('.')[0] + "_" + Date.now(),
    };
  }
});

const upload = multer({ storage: storage });

// Upload Endpoint
router.post("/", upload.single("file"), (req, res) => {
  try {
    console.log("📂 Received upload request for:", req.file?.originalname);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    console.log("✅ Cloudinary URL:", req.file.path);
    res.json({ url: req.file.path });
  } catch (err) {
    console.error("❌ CLOUDINARY UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
