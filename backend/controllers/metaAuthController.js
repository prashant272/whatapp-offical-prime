import axios from "axios";
import MetaPage from "../models/MetaPage.js";

// Fetch long-lived token (Optional, usually we can just rely on the token sent from frontend or exchange it)
// But for simplicity, we can let frontend send the page access token and we save it.
// To be safe, Facebook Page Access Tokens obtained via the Graph API after logging in are usually long-lived if requested properly.

export const connectMetaPages = async (req, res) => {
  try {
    const { pages, whatsappAccountId } = req.body;
    
    if (!pages || !pages.length || !whatsappAccountId) {
      return res.status(400).json({ success: false, message: "Pages and WhatsApp Account ID are required." });
    }

    const savedPages = [];

    for (const page of pages) {
      // Find and update, or create
      const metaPage = await MetaPage.findOneAndUpdate(
        { pageId: page.id },
        {
          pageName: page.name,
          pageAccessToken: page.access_token,
          whatsappAccountId: whatsappAccountId
        },
        { new: true, upsert: true }
      );
      
      // Optionally, here we should subscribe the page to our webhook via Graph API
      // POST https://graph.facebook.com/{page-id}/subscribed_apps
      // We will assume the user has configured Webhooks in the App Dashboard, but we still need to subscribe the specific page.
      const appId = process.env.FACEBOOK_APP_ID || "1615467726832537";
      
      try {
        await axios.post(`https://graph.facebook.com/v19.0/${page.id}/subscribed_apps`, {
          subscribed_fields: "leadgen"
        }, {
          params: { access_token: page.access_token }
        });
        console.log(`✅ Successfully subscribed App to Page ${page.name}`);
      } catch (err) {
        console.error(`⚠️ Failed to subscribe app to page ${page.name}:`, err.response?.data || err.message);
      }

      savedPages.push(metaPage);
    }

    res.status(200).json({ success: true, pages: savedPages });
  } catch (error) {
    console.error("Error connecting meta pages:", error);
    res.status(500).json({ success: false, message: "Server error connecting pages." });
  }
};

export const getConnectedPages = async (req, res) => {
  try {
    const pages = await MetaPage.find().populate("whatsappAccountId", "name phone");
    res.status(200).json({ success: true, pages });
  } catch (error) {
    console.error("Error fetching connected pages:", error);
    res.status(500).json({ success: false, message: "Server error fetching pages." });
  }
};

export const disconnectMetaPage = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPage = await MetaPage.findByIdAndDelete(id);
    
    if (!deletedPage) {
      return res.status(404).json({ success: false, message: "Page not found." });
    }

    // Optionally unsubscribe from the webhook via Graph API
    try {
      await axios.delete(`https://graph.facebook.com/v19.0/${deletedPage.pageId}/subscribed_apps`, {
        params: { access_token: deletedPage.pageAccessToken }
      });
      console.log(`✅ Successfully unsubscribed App from Page ${deletedPage.pageName}`);
    } catch (err) {
      console.error(`⚠️ Failed to unsubscribe app from page ${deletedPage.pageName}:`, err.response?.data || err.message);
    }

    res.status(200).json({ success: true, message: "Page disconnected successfully." });
  } catch (error) {
    console.error("Error disconnecting meta page:", error);
    res.status(500).json({ success: false, message: "Server error disconnecting page." });
  }
};
