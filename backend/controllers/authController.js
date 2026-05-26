import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { logActivity } from "../utils/activityLogger.js";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret_key", { expiresIn: "30d" });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      if (user.isActive === false) {
        return res.status(403).json({ error: "Your account is disabled. Please contact the administrator." });
      }
      await logActivity(user._id, "LOGIN", "User logged into dashboard");
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive !== false,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ error: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    await logActivity(req.user._id, "LOGOUT", "User logged out of dashboard");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
