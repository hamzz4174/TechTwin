import express from "express";
import upload from "./upload.js";
import Submission from "./Submission.js";

const router = express.Router();

// Submit assignment (student)
router.post("/submit", upload.single("file"), async (req, res) => {
  try {
    const { assignmentId, studentId } = req.body;
    if (!assignmentId || !studentId) return res.status(400).json({ error: "assignmentId and studentId required" });

    const submission = new Submission({
      assignmentId,
      studentId,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null
    });

    await submission.save();
    res.status(201).json({ message: "Submission successful", submission });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get submissions for a given assignment (teacher view)
router.get("/assignment/:assignmentId", async (req, res) => {
  try {
    const submissions = await Submission.find({ assignmentId: req.params.assignmentId }).sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get submissions by student
router.get("/student/:studentId", async (req, res) => {
  try {
    const submissions = await Submission.find({ studentId: req.params.studentId }).sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
