// createAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./User.js";

dotenv.config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    // Check if admin already exists
    const exists = await User.findOne({ email: "admin@example.com" });
    if (exists) {
      console.log("⚠️ Admin already exists");
      return mongoose.disconnect();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    await User.create({
      name: "Admin",
      email: "admin@example.com",
      password: hashedPassword, // use the hashed password
      role: "admin",
      status: "approved"
    });

    console.log("✅ Admin created successfully!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error creating admin:", err);
    mongoose.disconnect();
  }
}

createAdmin();
