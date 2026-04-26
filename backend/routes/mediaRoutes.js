import express from "express";
import axios from "axios";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/proxy", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    console.log("🛠️ Proxying URL:", url);
    
    const response = await axios({
      method: "get",
      url: url,
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      },
      timeout: 10000
    });

    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (error) {
    console.error("❌ Media Proxy Error Details:", error.response?.data ? JSON.stringify(error.response.data) : error.message);
    res.status(500).json({ error: "Failed to proxy media", details: error.message });
  }
});

export default router;
