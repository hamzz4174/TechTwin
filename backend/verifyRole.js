import jwt from "jsonwebtoken";

export const verifyRole = (roles) => (req, res, next) => {

  const authHeader = req.headers.authorization;
  console.log("Authorization Header:", authHeader);

  if (!authHeader) {
    return res.status(401).json({ success:false,error:"No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    console.log("Decoded Token:", decoded);

    req.user = decoded;

    if (!roles.includes(decoded.role)) {
      return res.status(403).json({ success:false,error:"Access denied" });
    }

    next();

  } catch(err) {

    console.error("JWT verification error:", err);
    return res.status(401).json({ success:false,error:"Invalid token" });

  }
};