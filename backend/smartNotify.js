import express from "express";
import Notification from "./notification.js";
import User from "./User.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// ─────────────────────────────────────────────────────
// HELPER: Send smart in-app notification + optional email/SMS
// ─────────────────────────────────────────────────────
export async function sendSmartNotification({ userId, type, title, message, icon, link, channel = "in_app" }) {
  try {
    // Save in-app notification
    const notif = await Notification.create({ userId, type, title, message, icon, link, channel });

    // Email notification (uses SendGrid if configured)
    if ((channel === "email" || channel === "all") && process.env.SENDGRID_KEY) {
      await sendEmail(userId, title, message);
    }

    // SMS notification (uses Twilio if configured)
    if ((channel === "sms" || channel === "all") && process.env.TWILIO_SID) {
      await sendSMS(userId, message);
    }

    return notif;
  } catch (err) {
    console.error("❌ Smart notification error:", err.message);
  }
}

// ─────────────────────────────────────────────────────
// Email via SendGrid (#31)
// ─────────────────────────────────────────────────────
async function sendEmail(userId, subject, body) {
  try {
    if (!process.env.SENDGRID_KEY) return;
    const user = await User.findById(userId);
    if (!user || !user.emailNotifications) return;

    const sgMail = await import("@sendgrid/mail").catch(() => null);
    if (!sgMail) return;

    sgMail.default.setApiKey(process.env.SENDGRID_KEY);
    await sgMail.default.send({
      to: user.email,
      from: process.env.SENDGRID_FROM || "noreply@techtwin.ai",
      subject: `TechTwin: ${subject}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:40px;background:#0f0f1a;color:#fff;border-radius:16px;">
          <div style="text-align:center;margin-bottom:32px;">
            <h1 style="background:linear-gradient(135deg,#8B5CF6,#0D9488);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px;">TechTwin</h1>
            <p style="color:#6b7280;font-size:14px;">AI-Powered Learning Platform</p>
          </div>
          <div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:24px;margin-bottom:24px;">
            <h2 style="color:#8B5CF6;margin:0 0 12px;">${subject}</h2>
            <p style="color:#e5e7eb;line-height:1.6;">${body}</p>
          </div>
          <p style="color:#6b7280;font-size:12px;text-align:center;">© 2026 TechTwin · Built radically different</p>
        </div>
      `
    });
    console.log(`📧 Email sent to ${user.email}`);
  } catch (err) {
    console.error("📧 Email error:", err.message);
  }
}

// ─────────────────────────────────────────────────────
// SMS via Twilio (#31)
// ─────────────────────────────────────────────────────
async function sendSMS(userId, message) {
  try {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) return;
    const user = await User.findById(userId);
    if (!user || !user.phone || !user.smsNotifications) return;

    const twilio = await import("twilio").catch(() => null);
    if (!twilio) return;

    const client = twilio.default(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await client.messages.create({
      body: `TechTwin: ${message}`,
      from: process.env.TWILIO_PHONE,
      to: user.phone
    });
    console.log(`📱 SMS sent to ${user.phone}`);
  } catch (err) {
    console.error("📱 SMS error:", err.message);
  }
}

// ─────────────────────────────────────────────────────
// GET Notifications for user (#31)
// ─────────────────────────────────────────────────────
router.get("/:userId", async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { userId: req.params.userId },
        { userId: null } // broadcast
      ]
    }).sort({ createdAt: -1 }).limit(20);

    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// GET All broadcast notifications (public)
// ─────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: null }).sort({ createdAt: -1 }).limit(10);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// Mark notification as read
// ─────────────────────────────────────────────────────
router.patch("/read/:id", async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────
// Create broadcast notification (admin use)
// ─────────────────────────────────────────────────────
router.post("/broadcast", async (req, res) => {
  try {
    const { title, message, icon, type } = req.body;
    const notif = await Notification.create({ title, message, icon: icon || "📢", type: type || "broadcast" });
    res.json({ success: true, data: notif });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
