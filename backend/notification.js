import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // null = broadcast
  message: { type: String, required: true },
  title: { type: String, default: "TechTwin" },
  type: {
    type: String,
    enum: ["welcome", "login_alert", "ai_reply", "teacher_reply", "study_reminder", "streak", "quiz_ready", "broadcast", "pdf"],
    default: "broadcast"
  },
  icon: { type: String, default: "🔔" },
  link: { type: String }, // optional deep link
  read: { type: Boolean, default: false },
  channel: { type: String, enum: ["in_app", "email", "sms", "all"], default: "in_app" },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800 // 7 days TTL
  }
});

export default mongoose.model("Notification", notificationSchema);