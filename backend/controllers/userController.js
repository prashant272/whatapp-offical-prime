import User from "../models/User.js";
import { logActivity } from "../utils/activityLogger.js";

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = await User.create({ name, email, password, role });
    
    await logActivity(req.user._id, "CREATE_USER", `Created user ${name} with role ${role}`, email);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      await logActivity(req.user._id, "DELETE_USER", `Deleted user ${user.name}`, user.email);
      await User.deleteOne({ _id: req.params.id });
      res.json({ message: "User removed" });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

import { getIO } from "../utils/socket.js";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret_key", { expiresIn: "30d" });
};

export const updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    
    if (isActive !== undefined) {
      const oldIsActive = user.isActive;
      user.isActive = isActive;
      
      // If disabled, trigger Socket.io event to force logout
      if (isActive === false && oldIsActive !== false) {
        try {
          const io = getIO();
          io.to(`user_${user._id}`).emit("force_logout", {
            message: "Your account has been disabled by the administrator. You will be logged out in 10 seconds."
          });
        } catch (err) {
          console.error("Socket error on force logout emit:", err);
        }
      }
    }
    
    if (password) user.password = password;

    await user.save();
    await logActivity(req.user._id, "UPDATE_USER", `Updated user info for ${user.name}`, user.email);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const impersonateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.isActive === false) {
      return res.status(400).json({ error: "Cannot login to a deactivated user account." });
    }

    await logActivity(req.user._id, "IMPERSONATE_USER", `Admin impersonated user ${user.name}`, user.email);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
