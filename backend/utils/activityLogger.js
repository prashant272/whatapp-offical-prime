import ActivityLog from "../models/ActivityLog.js";
import axios from "axios";

export const logActivity = async (userId, action, details, target = "", req = null) => {
  try {
    let ipAddress = "";
    let location = "";

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || "";
      if (ipAddress && ipAddress !== "::1" && ipAddress !== "127.0.0.1") {
        try {
          // Extract first IP if multiple
          const ipToLookup = ipAddress.split(',')[0].trim();
          const geoRes = await axios.get(`http://ip-api.com/json/${ipToLookup}`);
          if (geoRes.data.status === "success") {
            location = `${geoRes.data.city}, ${geoRes.data.regionName}, ${geoRes.data.country}`;
          }
        } catch (e) {
          console.error("GeoIP lookup failed", e.message);
        }
      } else {
        ipAddress = "Localhost";
        location = "Local Server";
      }
    }

    await ActivityLog.create({
      user: userId,
      action,
      details,
      target,
      ipAddress,
      location
    });
  } catch (error) {
    console.error("❌ Failed to log activity:", error);
  }
};
