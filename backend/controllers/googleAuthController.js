import { google } from "googleapis";
import User from "../models/User.js";

const getOauth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "postmessage" // Using postmessage for frontend-based flow
  );
};

export const getAuthUrl = (req, res) => {
  // Not used in postmessage flow, but good to have
  const oauth2Client = getOauth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly"
    ],
    prompt: "consent"
  });
  res.json({ url });
};

export const handleCallback = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code is required" });

    const oauth2Client = getOauth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (tokens.refresh_token) {
      await User.findByIdAndUpdate(req.user._id, {
        googleRefreshToken: tokens.refresh_token
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Google Callback Error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
};

export const checkAuthStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ isAuthenticated: !!user.googleRefreshToken });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

export const disconnectGoogle = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { googleRefreshToken: 1 }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};
