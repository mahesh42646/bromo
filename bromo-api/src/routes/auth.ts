import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { Admin } from "../models/Admin.js";
import { PlatformSettings } from "../models/PlatformSettings.js";
import { signAdminToken } from "../utils/jwt.js";
import { requireAdminToken, type AuthedRequest } from "../middleware/authBearer.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }
  const admin = await Admin.findOne({ email }).select("+passwordHash");
  if (!admin || !admin.isActive) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const settings = await PlatformSettings.findOne({ key: "default" }).lean();
  const sessionTtl = settings?.security?.adminSessionTtl;
  admin.lastLoginAt = new Date();
  await admin.save();
  const token = signAdminToken({
    sub: String(admin._id),
    email: admin.email,
    role: admin.role,
  }, sessionTtl);
  return res.json({
    token,
    admin: {
      id: String(admin._id),
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  });
});

router.get("/me", requireAdminToken, async (req: AuthedRequest, res) => {
  const admin = await Admin.findById(req.admin!.id).lean();
  if (!admin) {
    return res.status(404).json({ message: "Admin not found" });
  }
  return res.json({
    id: String(admin._id),
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });
});

export { router as authRouter };
