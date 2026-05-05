import multer from "multer"
import axios from "axios"
import FormData from "form-data"
import fs from "fs"
import express from "express";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { body, validationResult } from "express-validator";
import User from "./User.js";
import Query from "./query.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { verifyRole } from "./verifyRole.js";
import { sendSmartNotification } from "./smartNotify.js";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openaiKey = process.env.OPENAI_API_KEY;
const openai = openaiKey && !openaiKey.includes("YOUR_OPENAI") ? new OpenAI({ apiKey: openaiKey }) : null;
const router = express.Router();  

const upload = multer({ dest: "uploads/" })

let voices = []

async function generateAIReply(queryId, queryText, subject, userId) {
  try {
    const prompt = `You are a helpful AI tutor specialized in ${subject}. 
Answer this student's question clearly and concisely:
"${queryText}"`;

    // Generate using OpenAI Chat API
    if (!openai) throw new Error("OpenAI client not initialized");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // small + fast
      messages: [
        { role: "system", content: "You are an intelligent teacher assistant helping students understand concepts." },
        { role: "user", content: prompt }
      ],
      max_tokens: 300
    });

    const aiReply = completion.choices[0].message.content;

    // Save to DB
    const updatedQuery = await Query.findByIdAndUpdate(
      queryId,
      { aiReply, status: "ai_replied" },
      { new: true }
    );

    console.log("✅ OpenAI reply saved for query:", queryId);

    // Send via SSE (real-time update to frontend)
    if (sseClients.has(userId)) {
      sseClients.get(userId).res.write(`data: ${JSON.stringify(updatedQuery)}\n\n`);
    }
  } catch (err) {
    console.error("❌ OpenAI generation failed:", err);
  }
}

router.patch("/approve-teacher/:id", verifyRole(["hod", "superadmin"]), async (req, res) => {
  try {
    const teacherId = req.params.id;

    let teacher;

    if (req.user.role === "hod") {
      // HOD can approve only their own teachers
      teacher = await User.findOne({ _id: teacherId, role: "teacher", hodId: req.user.id });
    } else if (req.user.role === "superadmin") {
      // Superadmin can approve any teacher
      teacher = await User.findOne({ _id: teacherId, role: "teacher" });
    }

    if (!teacher) 
      return res.status(404).json({ success: false, error: "Teacher not found or not allowed" });

    teacher.status = "approved";
    await teacher.save();

    res.json({ success: true, message: "Teacher approved successfully", data: teacher });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

router.get("/teachers", verifyRole(["hod", "superadmin"]), async (req, res) => {
  try {
    let filter = { role: "teacher" };

    // If HOD, filter only their teachers
    if (req.user.role === "hod") {
      filter.hodId = req.user.id;
    }

    const teachers = await User.find(filter)
  .populate("hodId","name email")
  .select("-password");

    // Ensure each teacher has a subjects array
    const formattedTeachers = teachers.map(teacher => ({
  _id: teacher._id,
  name: teacher.name,
  email: teacher.email,
  status: teacher.status,
  hodName: teacher.hodId ? teacher.hodId.name : "-",
  subjects: Array.isArray(teacher.subjects) ? teacher.subjects : []
}));

    res.status(200).json({ success: true, data: formattedTeachers });
  } catch (err) {
    console.error("Get teachers error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


// ----------------------------
// REGISTER SUPERADMIN (ONLY IF NONE EXISTS)
// ----------------------------
router.post(
  "/register-superadmin",
  async (req, res) => {
    try {
      const { name, email, password, secretKey } = req.body;

      // Optional: Require a secret key for security
      if (secretKey !== process.env.SUPERADMIN_KEY) {
        return res.status(403).json({ success: false, error: "Invalid secret key" });
      }

      // Check if a Superadmin already exists
      const existing = await User.findOne({ role: "superadmin" });
      if (existing) return res.status(400).json({ success: false, error: "Superadmin already exists" });

      // Hash password
      const hashed = await bcrypt.hash(password, 10);

      const superadmin = await User.create({
        name,
        email,
        password: hashed,
        role: "superadmin",
        status: "approved"
      });

      res.status(201).json({
        success: true,
        message: "Superadmin registered successfully!",
        data: {
          id: superadmin._id,
          name: superadmin.name,
          email: superadmin.email,
          role: superadmin.role
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);




// HOD Registration (only Superadmin)
router.post(
  "/register-hod",
  verifyRole(["superadmin"]),
  async (req, res) => {
    try {
      const { name, email, password, department } = req.body;

      if (!name || !email || !password || !department) {
        return res.status(400).json({ success: false, error: "All fields are required" });
      }

      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ success: false, error: "Email already registered" });

      const hashed = await bcrypt.hash(password, 10);

      const hod = await User.create({
        name,
        email,
        password: hashed,
        role: "hod",
        status: "approved",
        department
      });

      res.status(201).json({
        success: true,
        message: "HOD registered successfully",
        data: {
          id: hod._id,
          name: hod.name,
          email: hod.email,
          role: hod.role,
          department: hod.department
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);
router.post("/assign-subject", verifyRole(["hod"]), async (req, res) => {
  try {
    const { teacherId, subject } = req.body;
    if (!teacherId || !subject) {
      return res.status(400).json({ success: false, error: "Teacher ID and subject are required" });
    }

    // Find teacher under this HOD
    const teacher = await User.findOne({ _id: teacherId, hodId: req.user.id });
    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher not found or not under your HOD" });
    }

    teacher.subjects = teacher.subjects || [];
    if (!teacher.subjects.includes(subject)) {
      teacher.subjects.push(subject);
    }

    await teacher.save();

    // Format response to include subjects and status
    const formattedTeacher = {
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      status: teacher.status || "Active",
      subjects: teacher.subjects,
    };

    res.json({ success: true, message: "Subject assigned successfully", data: formattedTeacher });
  } catch (err) {
    console.error("Assign subject route error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


// ----------------------------
// REGISTER TEACHER (only HOD)
// ----------------------------
router.post(
  "/register-teacher",
  verifyRole(["superadmin","hod"]),  // <- middleware ensures only HOD can access
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: "All fields are required" });
      }

      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ success: false, error: "Email already registered" });

      const hashed = await bcrypt.hash(password, 10);
      

     const teacher = await User.create({
  name,
  email,
  password: hashed,
  role: "teacher",
  status: req.user.role === "superadmin" ? "approved" : "pending",
  hodId: req.user.role === "superadmin" ? req.body.hodId : req.user.id
});

      res.status(201).json({
        success: true,
        message: "Teacher registered successfully! Pending approval.",
        data: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          role: teacher.role,
          hodId: teacher.hodId
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
  
);


// Initialize Gemini AI


// Map to store active SSE connections
const sseClients = new Map();

// ----------------------------
// REGISTER
// ----------------------------
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password min 6 chars"),
    body("role").isIn(["student", "teacher"]).withMessage("Role must be student or teacher")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { name, email, password, role } = req.body;

      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ success: false, error: "Email already registered" });

      const hashed = await bcrypt.hash(password, 10);
      const status = role === "teacher" ? "pending" : "approved";
      const hodId = role === "teacher" ? req.user?.id : undefined; // Assign HOD supervising teacher

      const user = await User.create({ name, email, password: hashed, role, status, hodId });

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      // ✅ Smart Welcome Notification (#31)
      sendSmartNotification({
        userId: user._id,
        type: "welcome",
        icon: "🚀",
        title: "Welcome to TechTwin!",
        message: `Welcome to TechTwin 🚀 ${user.name}! Your AI learning journey starts now. Try asking your first doubt!`,
        channel: "in_app"
      });

      res.status(201).json({
        success: true,
        message:
          role === "teacher"
            ? "Teacher registered successfully! Account pending admin approval."
            : "Registered successfully",
        data: {
          user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status },
          token
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// ----------------------------
// LOGIN
// ----------------------------
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { email, password } = req.body;

      const user = await User.findOne({ email }).select("+password");
      if (!user) return res.status(401).json({ success: false, error: "Invalid credentials" });

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ success: false, error: "Invalid credentials" });

      if (user.role === "teacher" && user.status === "pending") {
        return res.status(403).json({
          success: false,
          error: "Your account is under review. Please wait for admin approval."
        });
      }

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      // ✅ Smart Login Alert Notification (#31)
      sendSmartNotification({
        userId: user._id,
        type: "login_alert",
        icon: "🔐",
        title: "New Login Detected",
        message: `New login detected on your TechTwin account — ${new Date().toLocaleString()}. If this wasn't you, contact support.`,
        channel: "in_app"
      });

      res.json({
        success: true,
        message: "Logged in successfully",
        data: {
          user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status },
          token
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

// ----------------------------
// SAVE QUERY
// ----------------------------
router.post("/save-query", async (req, res) => {
  try {
    const { queryText, userId, subject } = req.body;

    const newQuery = new Query({
      queryText,
      userId,
      subject,
      aiReply: "",
      teacherReply: "",
      status: "pending",
      timestamp: new Date()
    });

    await newQuery.save();

    res.json({ success: true, message: "Query saved successfully", data: newQuery });

    // Fire-and-forget Gemini AI reply with SSE
    generateAIReply(newQuery._id, queryText, subject, userId);
  } catch (err) {
    console.error("❌ Error saving query:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


// ----------------------------
// Gemini AI Reply Function
// ----------------------------


// ----------------------------
// FETCH QUERIES
// ----------------------------
router.get("/fetch-queries", async (req, res) => {
  try {
    const { userId, subject } = req.query;
    let filter = {};
    if (userId) filter.userId = userId;
    if (subject) filter.subject = subject;

    const queries = await Query.find(filter).sort({ timestamp: -1 });

    res.status(200).json({ success: true, data: queries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ----------------------------
// TEACHER REPLY
// ----------------------------
router.post(
  "/reply/:id",
  [body("teacherReply").trim().notEmpty().withMessage("Reply is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { teacherReply } = req.body;

      const query = await Query.findById(req.params.id);
      if (!query) return res.status(404).json({ success: false, message: "Query not found" });

      query.teacherReply = teacherReply;
      query.status = "teacher_replied";
      await query.save();

      // Push teacher reply via SSE
      if (sseClients.has(query.userId.toString())) {
        sseClients.get(query.userId.toString()).res.write(`data: ${JSON.stringify(query)}\n\n`);
      }

      res.json({ success: true, message: "Teacher reply saved successfully", data: query });
    } catch (err) {
      console.error("❌ Teacher Reply Error:", err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
);

router.get("/hods", verifyRole(["superadmin"]), async (req, res) => {
  try {
    const hods = await User.find({ role: "hod" }).select("-password");
    res.status(200).json({ success: true, data: hods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


// ----------------------------
// SSE Endpoint
// ----------------------------
router.get("/sse/:userId", (req, res) => {
  const { userId } = req.params;
  const token = req.query.token;

  // --- Token validation ---
  if (!token) {
    return res.status(401).end("Unauthorized: Token missing");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    if (decoded.id !== userId) {
      return res.status(403).end("Forbidden: Token user mismatch");
    }
  } catch (err) {
    console.error("❌ SSE token verification failed:", err.message);
    return res.status(401).end("Unauthorized: Invalid token");
  }

  // --- If token valid, set up SSE ---
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const keepAlive = setInterval(() => res.write(":\n\n"), 20000);
  sseClients.set(userId, { res, keepAlive });

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(userId);
  });
});

router.get("/students-count", verifyRole(["superadmin"]), async (req,res)=>{

try{

const count = await User.countDocuments({ role:"student" })

res.json({
success:true,
count:count
})

}catch(err){

console.error(err)
res.status(500).json({success:false,error:"Server error"})

}

})

router.post("/addVoice", upload.single("voice"), async (req,res)=>{

const API_KEY = process.env.ELEVENLABS_KEY;

try{

const form = new FormData()

form.append("name", req.body.name)
form.append("files", fs.createReadStream(req.file.path))

const response = await axios.post(
"https://api.elevenlabs.io/v1/voices/add",
form,
{
headers:{
"xi-api-key":API_KEY ,
...form.getHeaders()
}
}
)

voices.push({
name:req.body.name,
voice_id:response.data.voice_id
})

res.json({
success:true,
name:req.body.name
})

}catch(err){

console.log(err.response?.data || err.message)

res.status(500).json({error:"Voice creation failed"})

}

})
router.get("/voices", async (req,res)=>{

try{

const response = await axios.get(
"https://api.elevenlabs.io/v1/voices",
{
headers:{
"xi-api-key": process.env.ELEVENLABS_KEY
}
}
)

const voices = response.data.voices.map(v=>({
name:v.name,
voice_id:v.voice_id
}))

res.json({voices})

}catch(err){

console.log(err.response?.data || err.message)

res.status(500).json({error:"Failed to fetch voices"})

}

})
export default router;