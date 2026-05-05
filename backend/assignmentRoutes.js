import express from "express";
import upload from "./upload.js";
import Assignment from "./Assignment.js";

const router = express.Router();

// Create assignment (teacher)
router.post("/create", upload.single("file"), async (req, res) => {
  try {
    const { title, description, deadline, createdBy } = req.body;
    if (!title || !createdBy) return res.status(400).json({ error: "title and createdBy required" });

    const assignment = new Assignment({
      title,
      description,
      deadline: deadline ? new Date(deadline) : undefined,
      createdBy,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null
    });

    await assignment.save();
    res.status(201).json({ message: "Assignment created", assignment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all assignments
router.get("/", async (req, res) => {
  try {
    const assignments = await Assignment.find().sort({ createdAt: -1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single assignment
router.get("/:id", async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
