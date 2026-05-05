// backend/admin.js
import express from "express";
import User from "./User.js";
import jwt from "jsonwebtoken";

const router = express.Router();

function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if(!token) return res.status(401).json({error:"No token"});
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if(decoded.role !== "admin") return res.status(403).json({error:"Not admin"});
    req.user = decoded;
    next();
  } catch(err) { return res.status(401).json({error:"Invalid token"}); }
}

// GET pending teachers
router.get("/pending-teachers", authAdmin, async (req,res)=>{
  try {
    const teachers = await User.find({role:"teacher", status:"pending"});
    res.json(teachers);
  } catch(err){ res.status(500).json({error:"Server error"}); }
});

// PUT approve teacher
router.put("/approve/:id", authAdmin, async (req,res)=>{
  try {
    const teacher = await User.findById(req.params.id);
    if(!teacher) return res.status(404).json({error:"Teacher not found"});
    teacher.status="approved";
    await teacher.save();
    res.json({message:"Teacher approved"});
  } catch(err){ res.status(500).json({error:"Server error"}); }
});

export default router;
