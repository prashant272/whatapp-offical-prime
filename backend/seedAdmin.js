import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp-dashboard");

    const adminExists = await User.findOne({ role: "Admin" });
    if (adminExists) {
      console.log("Admin already exists:", adminExists.email);
      process.exit();
    }

    const admin = new User({
      name: "Admin User",
      email: "admin@primeimpact.in",
      password: "Pra@1234", // Will be hashed by pre-save hook
      role: "Admin"
    });

    await admin.save();
    console.log("Admin user created successfully!");
    console.log("Email: admin@example.com");
    console.log("Password: adminpassword");
    process.exit();
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
