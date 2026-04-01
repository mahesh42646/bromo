import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { PlatformSettings, VALID_ACCENT_IDS } from "../models/PlatformSettings.js";
import { requireAdminToken } from "../middleware/authBearer.js";

// Inline palette builder (mirrors platform-theme.ts — kept in sync manually)
type AccentShade = "dark" | "medium" | "light";

const ACCENT_COLORS: Record<string, Record<AccentShade, string>> = {
  bromoRed:  {dark: "#ff4d6d", medium: "#e94560", light: "#c0304f"},
  crimson:   {dark: "#ff6b6b", medium: "#ef4444", light: "#b91c1c"},
  orange:    {dark: "#ff8c42", medium: "#f97316", light: "#c2410c"},
  amber:     {dark: "#ffbe5c", medium: "#f59e0b", light: "#92400e"},
  yellow:    {dark: "#ffe566", medium: "#eab308", light: "#854d0e"},
  lime:      {dark: "#b6f03e", medium: "#84cc16", light: "#3f6212"},
  green:     {dark: "#4ade80", medium: "#22c55e", light: "#166534"},
  emerald:   {dark: "#34d399", medium: "#10b981", light: "#065f46"},
  teal:      {dark: "#2dd4bf", medium: "#14b8a6", light: "#0f766e"},
  cyan:      {dark: "#22d3ee", medium: "#06b6d4", light: "#0e7490"},
  sky:       {dark: "#38bdf8", medium: "#0ea5e9", light: "#075985"},
  blue:      {dark: "#60a5fa", medium: "#3b82f6", light: "#1e40af"},
  indigo:    {dark: "#818cf8", medium: "#6366f1", light: "#3730a3"},
  violet:    {dark: "#a78bfa", medium: "#8b5cf6", light: "#5b21b6"},
  purple:    {dark: "#c084fc", medium: "#a855f7", light: "#6b21a8"},
  fuchsia:   {dark: "#e879f9", medium: "#d946ef", light: "#86198f"},
  pink:      {dark: "#f472b6", medium: "#ec4899", light: "#9d174d"},
  rose:      {dark: "#fb7185", medium: "#f43f5e", light: "#9f1239"},
  coral:     {dark: "#ff7f7f", medium: "#ff6b6b", light: "#c0392b"},
  gold:      {dark: "#ffd700", medium: "#ca8a04", light: "#78350f"},
  copper:    {dark: "#fb923c", medium: "#d97706", light: "#7c2d12"},
  slate:     {dark: "#94a3b8", medium: "#64748b", light: "#1e293b"},
  lavender:  {dark: "#c4b5fd", medium: "#7c3aed", light: "#4c1d95"},
  jade:      {dark: "#52d9a0", medium: "#059669", light: "#064e3b"},
};

function resolveAccent(id: string, shade: AccentShade): string {
  return (ACCENT_COLORS[id] ?? ACCENT_COLORS.bromoRed)[shade];
}

function primaryFg(hex: string): "#000000" | "#ffffff" {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.35 ? "#000000" : "#ffffff";
}

function buildPalette(mode: "dark" | "light", accentId: string, shade: AccentShade) {
  const accent = resolveAccent(accentId, shade);
  const fg = primaryFg(accent);

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
      ring: accent, primary: accent, primaryForeground: fg,
      overlay: "rgba(0,0,0,0.75)",
      success: "#4ade80", successForeground: "#000000",
      warning: "#fbbf24", warningForeground: "#000000",
      info: "#60a5fa", infoForeground: "#000000",
      destructive: "#f87171", destructiveForeground: "#000000",
      muted: "#111111", mutedForeground: "rgba(255,255,255,0.55)",
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
    ring: accent, primary: accent, primaryForeground: fg,
    overlay: "rgba(0,0,0,0.50)",
    success: "#16a34a", successForeground: "#ffffff",
    warning: "#d97706", warningForeground: "#ffffff",
    info: "#0284c7", infoForeground: "#ffffff",
    destructive: "#dc2626", destructiveForeground: "#ffffff",
    muted: "#f5f5f5", mutedForeground: "rgba(0,0,0,0.55)",
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
  const accentId = (doc.theme as {accentColorId?: string}).accentColorId ?? "bromoRed";
  const shade = ((doc.theme as {accentShade?: string}).accentShade ?? "dark") as AccentShade;

  // Always compute palettes fresh from accentColorId — never trust stored free-form hex
  const resolvedDark  = buildPalette("dark",  accentId, shade);
  const resolvedLight = buildPalette("light", accentId, shade);

  return res.json({
    branding: doc.branding,
    theme: {
      defaultTheme: doc.theme.defaultTheme,
      fontFamily: doc.theme.fontFamily,
      accentColorId: accentId,
      accentShade: shade,
      dark: resolvedDark,
      light: resolvedLight,
    },
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

  if (body.theme && typeof body.theme === "object") {
    const t = body.theme as Record<string, unknown>;

    // Validate accentColorId
    if (t.accentColorId !== undefined) {
      if (!(VALID_ACCENT_IDS as readonly string[]).includes(t.accentColorId as string)) {
        return res.status(400).json({
          message: `Invalid accentColorId. Valid values: ${VALID_ACCENT_IDS.join(", ")}`,
        });
      }
    }

    // Validate accentShade
    if (t.accentShade !== undefined) {
      if (!["dark", "medium", "light"].includes(t.accentShade as string)) {
        return res.status(400).json({
          message: 'Invalid accentShade. Must be "dark", "medium", or "light".',
        });
      }
    }

    const accentId = (t.accentColorId as string) ?? "bromoRed";
    const shade    = ((t.accentShade as string) ?? "dark") as AccentShade;

    update.theme = {
      defaultTheme: t.defaultTheme ?? "system",
      fontFamily:   t.fontFamily   ?? "system-ui",
      useGoogleFont: t.useGoogleFont ?? false,
      googleFontFamily: t.googleFontFamily ?? "",
      accentColorId: accentId,
      accentShade: shade,
      // Pre-compute and cache resolved palettes
      dark:  buildPalette("dark",  accentId, shade),
      light: buildPalette("light", accentId, shade),
    };
  }

  if (body.maintenance && typeof body.maintenance === "object") update.maintenance = body.maintenance;
  if (body.security && typeof body.security === "object") update.security = body.security;
  if (body.featureFlags && typeof body.featureFlags === "object") update.featureFlags = body.featureFlags;
  if (body.whiteLabel && typeof body.whiteLabel === "object") update.whiteLabel = body.whiteLabel;
  if (body.variables && typeof body.variables === "object") update.variables = body.variables;
  if (body.brandGuidelines && typeof body.brandGuidelines === "object") update.brandGuidelines = body.brandGuidelines;

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
    const setPath = type === "favicon" ? "branding.faviconUrl" : "branding.logoUrl";

    await PlatformSettings.findOneAndUpdate(
      { key: "default" },
      { $set: { [setPath]: fileUrl } },
      { upsert: true, new: true },
    );

    return res.json({ type, url: fileUrl, path: filePath });
  },
);

export { router as settingsRouter };
