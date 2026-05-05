import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
  studentId: { type: String, required: true },
  fileUrl: String,
  submittedAt: { type: Date, default: Date.now },
  grade: { type: String, default: "Pending" }
});

export default mongoose.model("Submission", submissionSchema);
