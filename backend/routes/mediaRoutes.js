import express from "express";
import axios from "axios";
import { protect } from "../middleware/authMiddleware.js";
import WhatsAppAccount from "../models/WhatsAppAccount.js";

const router = express.Router();

router.get("/proxy", async (req, res) => {
  let { url, accountId } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    let token = process.env.ACCESS_TOKEN;
    
    if (accountId && accountId !== "undefined" && accountId !== "null") {
      const account = await WhatsAppAccount.findById(accountId);
      if (account?.accessToken) {
        token = account.accessToken.trim();
      }
    }

    let downloadUrl = url;

    // 🕵️‍♂️ SMART CHECK: If it's a Meta Media ID or an expired Lookaside URL, get a FRESH one
    const isMetaMedia = url.includes("lookaside.fbsbx.com") || !url.includes(".");
    
    if (isMetaMedia) {
      console.log("🔄 Meta Media detected. Fetching fresh download URL...");
      // Extract Media ID (it's either the whole string or the 'mid' param)
      let mediaId = url;
      if (url.includes("mid=")) {
        const urlObj = new URL(url);
        mediaId = urlObj.searchParams.get("mid");
      } else if (url.includes("/")) {
        mediaId = url.split("/").pop();
      }

      const metaRes = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      downloadUrl = metaRes.data.url;
      console.log("✅ Fresh URL obtained.");
    }

    const response = await axios({
      method: "get",
      url: downloadUrl,
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 20000
    });

    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (error) {
    console.error("❌ Media Proxy Error Detail:", {
      message: error.message,
      url: url,
      status: error.response?.status,
      data: error.response?.data
    });
    res.status(error.response?.status || 500).json({ error: "Failed to proxy media" });
  }
});

export default router;
