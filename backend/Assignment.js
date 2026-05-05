import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  deadline: Date,
  fileUrl: String,           // accessible path like /uploads/filename
  createdBy: { type: String, required: true }, // teacher id/email
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Assignment", assignmentSchema);
