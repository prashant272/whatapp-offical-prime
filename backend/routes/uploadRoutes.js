import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Cloudflare R2 Configuration
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Storage Engine
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.R2_BUCKET_NAME,
    contentType: function (req, file, cb) {
      cb(null, file.mimetype);
    },
    key: function (req, file, cb) {
      const extension = file.originalname.split('.').pop();
      const baseName = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, "_");
      cb(null, `whatsapp_templates/${baseName}_${Date.now()}.${extension}`);
    }
  })
});

// Upload Endpoint
router.post("/", upload.single("file"), (req, res) => {
  try {
    console.log("📂 Received upload request for:", req.file?.originalname);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    // Ensure the key doesn't have spaces or special characters, and encode it just in case
    const fileUrl = `${process.env.R2_PUBLIC_URL}/${encodeURIComponent(req.file.key).replace(/%2F/g, '/')}`;
    console.log("✅ R2 URL:", fileUrl);
    res.json({ url: fileUrl });
  } catch (err) {
    console.error("❌ R2 UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
