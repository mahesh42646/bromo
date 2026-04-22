import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { PlatformSettings } from "../models/PlatformSettings.js";
import { requireAdminToken } from "../middleware/authBearer.js";
import { getCdnBaseUrl } from "../utils/publicMediaUrl.js";

// ── Palette builder (mirrors platform-theme.ts) ───────────────────

function expandHex6(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return h.length === 6 ? h : "";
}

function contrastFg(hex: string): "#000000" | "#ffffff" {
  const h = expandHex6(hex);
  if (h.length !== 6) return "#000000";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.35 ? "#000000" : "#ffffff";
}

function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

function safeHex(hex: string, fallback: string): string {
  return isValidHex(hex) ? hex : fallback;
}

function buildPalette(mode: "dark" | "light", accentHex: string, ringHex: string, mutedHex: string) {
  const accent = safeHex(accentHex, mode === "dark" ? "#ff4d6d" : "#c0304f");
  const ring   = safeHex(ringHex, accent);
  let muted    = safeHex(mutedHex, mode === "dark" ? "#2a2a2a" : "#f0f0f0");
  if (mode === "light" && contrastFg(muted) === "#ffffff") {
    muted = "#e0e0e0";
  }
  const accentFg = contrastFg(accent);
  const mutedFg  = contrastFg(muted);

  if (mode === "dark") {
    return {
      background: "#000000", foreground: "#ffffff",
      foregroundMuted: "rgba(255,255,255,0.55)", foregroundSubtle: "rgba(255,255,255,0.38)",
      foregroundFaint: "rgba(255,255,255,0.25)", placeholder: "rgba(255,255,255,0.30)",
      surface: "#111111", surfaceHigh: "#1c1c1c", card: "#161616",
      glass: "rgba(255,255,255,0.06)", glassMid: "rgba(255,255,255,0.08)", glassFaint: "rgba(255,255,255,0.04)",
      border: "#2a2a2a", hairline: "rgba(255,255,255,0.08)",
      borderFaint: "rgba(255,255,255,0.10)", borderMid: "rgba(255,255,255,0.12)", borderHeavy: "rgba(255,255,255,0.18)",
      input: "rgba(255,255,255,0.06)", inputFocused: "rgba(255,255,255,0.08)",
      overlay: "rgba(0,0,0,0.75)",
      accent, accentForeground: accentFg, ring, muted, mutedForeground: mutedFg,
      destructive: "#f87171", destructiveForeground: "#000000",
      success: "#4ade80", successForeground: "#000000",
      warning: "#fbbf24", warningForeground: "#000000",
      primary: accent, primaryForeground: accentFg,
    };
  }
  return {
    background: "#ffffff", foreground: "#000000",
    foregroundMuted: "rgba(0,0,0,0.55)", foregroundSubtle: "rgba(0,0,0,0.38)",
    foregroundFaint: "rgba(0,0,0,0.25)", placeholder: "rgba(0,0,0,0.35)",
    surface: "#f5f5f5", surfaceHigh: "#ebebeb", card: "#fafafa",
    glass: "rgba(0,0,0,0.04)", glassMid: "rgba(0,0,0,0.06)", glassFaint: "rgba(0,0,0,0.02)",
    border: "#e0e0e0", hairline: "rgba(0,0,0,0.07)",
    borderFaint: "rgba(0,0,0,0.08)", borderMid: "rgba(0,0,0,0.10)", borderHeavy: "rgba(0,0,0,0.15)",
    input: "rgba(0,0,0,0.04)", inputFocused: "rgba(0,0,0,0.06)",
    overlay: "rgba(0,0,0,0.50)",
    accent, accentForeground: accentFg, ring, muted, mutedForeground: mutedFg,
    destructive: "#dc2626", destructiveForeground: "#ffffff",
    success: "#16a34a", successForeground: "#ffffff",
    warning: "#d97706", warningForeground: "#ffffff",
    primary: accent, primaryForeground: accentFg,
  };
}

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

async function getDoc() {
  const existing = await PlatformSettings.findOne({ key: "default" }).lean();
  if (existing) return existing;
  return (await PlatformSettings.create({ key: "default" })).toObject();
}

router.get("/", requireAdminToken, async (_req, res) => {
  return res.json(await getDoc());
});

router.get("/public", async (_req, res) => {
  const doc = await getDoc();
  const t = doc.theme as { accentHex?: string; ringHex?: string; mutedHex?: string };
  const accentHex = t.accentHex ?? "#ff4d6d";
  const ringHex   = t.ringHex   ?? accentHex;
  const mutedHex  = t.mutedHex  ?? "#2a2a2a";

  return res.json({
    branding: doc.branding,
    media: {
      cdnBaseUrl: getCdnBaseUrl(),
    },
    theme: {
      defaultTheme:    doc.theme.defaultTheme,
      fontFamily:      doc.theme.fontFamily,
      accentHex,
      ringHex,
      mutedHex,
      dark:  buildPalette("dark",  accentHex, ringHex, mutedHex),
      light: buildPalette("light", accentHex, ringHex, mutedHex),
    },
    maintenance:    doc.maintenance,
    featureFlags:   doc.featureFlags,
    whiteLabel:     doc.whiteLabel,
    variables:      doc.variables,
    brandGuidelines: doc.brandGuidelines,
  });
});

router.put("/", requireAdminToken, async (req, res) => {
  const body = req.body ?? {};
  const update: Record<string, unknown> = {};

  if (body.branding && typeof body.branding === "object") update.branding = body.branding;

  if (body.theme && typeof body.theme === "object") {
    const t = body.theme as Record<string, unknown>;

    // Validate hex colors
    const hexFields = ["accentHex", "ringHex", "mutedHex"] as const;
    for (const field of hexFields) {
      if (t[field] !== undefined && !isValidHex(t[field] as string)) {
        return res.status(400).json({ message: `Invalid hex color for ${field}: ${t[field]}` });
      }
    }

    const accentHex = (t.accentHex as string) ?? "#ff4d6d";
    const ringHex   = (t.ringHex   as string) ?? accentHex;
    const mutedHex  = (t.mutedHex  as string) ?? "#2a2a2a";

    update.theme = {
      defaultTheme:    t.defaultTheme    ?? "system",
      fontFamily:      t.fontFamily      ?? "system-ui",
      useGoogleFont:   t.useGoogleFont   ?? false,
      googleFontFamily: t.googleFontFamily ?? "",
      accentHex,
      ringHex,
      mutedHex,
      dark:  buildPalette("dark",  accentHex, ringHex, mutedHex),
      light: buildPalette("light", accentHex, ringHex, mutedHex),
    };
  }

  if (body.maintenance && typeof body.maintenance === "object")    update.maintenance    = body.maintenance;
  if (body.security && typeof body.security === "object")          update.security       = body.security;
  if (body.featureFlags && typeof body.featureFlags === "object")  update.featureFlags   = body.featureFlags;
  if (body.whiteLabel && typeof body.whiteLabel === "object")      update.whiteLabel     = body.whiteLabel;
  if (body.variables && typeof body.variables === "object")        update.variables      = body.variables;
  if (body.brandGuidelines && typeof body.brandGuidelines === "object") update.brandGuidelines = body.brandGuidelines;

  const doc = await PlatformSettings.findOneAndUpdate(
    { key: "default" },
    { $set: update },
    { upsert: true, new: true },
  ).lean();
  return res.json(doc);
});

router.post("/upload", requireAdminToken, upload.single("file"), async (req, res) => {
  const type = req.query.type === "favicon" ? "favicon" : "logo";
  if (!req.file) return res.status(400).json({ message: "File is required" });
  const publicBase = process.env.PUBLIC_API_BASE_URL ?? "https://bromo.darkunde.in";
  const filePath = `/uploads/settings/${req.file.filename}`;
  const fileUrl = `${publicBase}${filePath}`;
  await PlatformSettings.findOneAndUpdate(
    { key: "default" },
    { $set: { [type === "favicon" ? "branding.faviconUrl" : "branding.logoUrl"]: fileUrl } },
    { upsert: true, new: true },
  );
  return res.json({ type, url: fileUrl, path: filePath });
});

export { router as settingsRouter };
