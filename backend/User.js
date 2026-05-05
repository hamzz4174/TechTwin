import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["superadmin", "hod", "teacher", "student"], required: true },
    status: { type: String, enum: ["pending", "approved"], default: "approved" },
    department: { type: String },
    hodId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    subjects: { type: [String], default: [] },

    // ─── Learning Profile (Streak + Gamification) ───
    streak: { type: Number, default: 0 },
    lastActiveDate: { type: Date },
    xpPoints: { type: Number, default: 0 },
    difficultyLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },

    // ─── Smart Notifications ───
    phone: { type: String }, // for SMS
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
