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
    const response = await axios({
      method: "get",
      url: url,
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    });

    // Pipe the content type and data back to client
    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (error) {
    console.error("❌ Media Proxy Error:", error.message);
    res.status(500).json({ error: "Failed to proxy media" });
  }
});

export default router;
