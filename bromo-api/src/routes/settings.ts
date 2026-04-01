import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { PlatformSettings } from "../models/PlatformSettings.js";
import { requireAdminToken } from "../middleware/authBearer.js";

const router = Router();
const uploadsDir = path.resolve(process.cwd(), "uploads/settings");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});
const upload = multer({ storage });

async function getSettingsDocument() {
  const existing = await PlatformSettings.findOne({ key: "default" }).lean();
  if (existing) return existing;
  return (await PlatformSettings.create({ key: "default" })).toObject();
}

router.get("/", requireAdminToken, async (_req, res) => {
  const doc = await getSettingsDocument();
  return res.json(doc);
});

router.get("/public", async (_req, res) => {
  const doc = await getSettingsDocument();
  return res.json({
    branding: doc.branding,
    theme: doc.theme,
    maintenance: doc.maintenance,
    featureFlags: doc.featureFlags,
    whiteLabel: doc.whiteLabel,
    variables: doc.variables,
    brandGuidelines: doc.brandGuidelines,
  });
});

router.put("/", requireAdminToken, async (req, res) => {
  const body = req.body ?? {};
  const update: Record<string, unknown> = {};
  if (body.branding && typeof body.branding === "object") update.branding = body.branding;
  if (body.theme && typeof body.theme === "object") update.theme = body.theme;
  if (body.maintenance && typeof body.maintenance === "object") {
    update.maintenance = body.maintenance;
  }
  if (body.security && typeof body.security === "object") update.security = body.security;
  if (body.featureFlags && typeof body.featureFlags === "object") {
    update.featureFlags = body.featureFlags;
  }
  if (body.whiteLabel && typeof body.whiteLabel === "object") update.whiteLabel = body.whiteLabel;
  if (body.variables && typeof body.variables === "object") update.variables = body.variables;
  if (body.brandGuidelines && typeof body.brandGuidelines === "object") {
    update.brandGuidelines = body.brandGuidelines;
  }

  const doc = await PlatformSettings.findOneAndUpdate(
    { key: "default" },
    { $set: update },
    { upsert: true, new: true },
  ).lean();
  return res.json(doc);
});

router.post(
  "/upload",
  requireAdminToken,
  upload.single("file"),
  async (req, res) => {
    const type = req.query.type === "favicon" ? "favicon" : "logo";
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const publicBase =
      process.env.PUBLIC_API_BASE_URL ?? "https://bromo.darkunde.in";
    const filePath = `/uploads/settings/${req.file.filename}`;
    const fileUrl = `${publicBase}${filePath}`;

    const setPath =
      type === "favicon" ? "branding.faviconUrl" : "branding.logoUrl";

    await PlatformSettings.findOneAndUpdate(
      { key: "default" },
      { $set: { [setPath]: fileUrl } },
      { upsert: true, new: true },
    );

    return res.json({
      type,
      url: fileUrl,
      path: filePath,
    });
  },
);

export { router as settingsRouter };

