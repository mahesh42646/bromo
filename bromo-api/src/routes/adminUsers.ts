import { Router } from "express";
import { User } from "../models/User.js";
import { Admin } from "../models/Admin.js";
import { requireAdminToken, type AuthedRequest } from "../middleware/authBearer.js";

const router = Router();

/* ── Platform users ───────────────────────────────────────────────────── */

router.get("/users", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "20"), 10));
    const search    = String(req.query.search    ?? "").trim();
    const provider  = String(req.query.provider  ?? "");
    const status    = String(req.query.status    ?? "");
    const onboarding = String(req.query.onboarding ?? "");

    type Filter = {
      $or?: Array<Record<string, { $regex: string; $options: string }>>;
      provider?: string;
      isActive?: boolean;
      onboardingComplete?: boolean;
    };

    const filter: Filter = {};
    if (search) {
      filter.$or = [
        { email:       { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
        { username:    { $regex: search, $options: "i" } },
      ];
    }
    if (provider === "email" || provider === "google") filter.provider = provider;
    if (status === "active")   filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    if (onboarding === "complete") filter.onboardingComplete = true;
    if (onboarding === "pending")  filter.onboardingComplete = false;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-firebaseUid -__v")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("adminUsers GET /users", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users/stats", requireAdminToken, async (_req: AuthedRequest, res) => {
  try {
    const [total, active, inactive, pendingOnboarding, google] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ onboardingComplete: false }),
      User.countDocuments({ provider: "google" }),
    ]);
    return res.json({ total, active, inactive, pendingOnboarding, google });
  } catch (err) {
    console.error("adminUsers GET /users/stats", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users/:id", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const user = await User.findById(req.params.id).select("-firebaseUid -__v").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("adminUsers GET /users/:id", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/users/:id", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const allowed = ["isActive", "displayName", "bio", "onboardingComplete"] as const;
    const update: Partial<Record<(typeof allowed)[number], unknown>> = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, select: "-firebaseUid -__v" },
    ).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("adminUsers PATCH /users/:id", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/users/:id", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const result = await User.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "User not found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("adminUsers DELETE /users/:id", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* ── Admin accounts ──────────────────────────────────────────────────── */

router.get("/admins", requireAdminToken, async (_req: AuthedRequest, res) => {
  try {
    const admins = await Admin.find().select("-passwordHash -__v").sort({ createdAt: 1 }).lean();
    return res.json(admins);
  } catch (err) {
    console.error("adminUsers GET /admins", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/admins/:id", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const { isActive, role } = req.body as { isActive?: boolean; role?: string };
    const update: { isActive?: boolean; role?: string } = {};
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (role === "admin" || role === "super_admin") update.role = role;

    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, select: "-passwordHash -__v" },
    ).lean();
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    return res.json(admin);
  } catch (err) {
    console.error("adminUsers PATCH /admins/:id", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export { router as adminUsersRouter };
