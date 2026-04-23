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
      await logActivity(user._id, "LOGIN", "User logged into dashboard");
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ error: "Invalid email or password" });
    }
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
