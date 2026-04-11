"use client";

import { useState } from "react";
import { Image, Palette, Save, Type } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type FontOption = "system-ui" | "Inter" | "Poppins" | "DM Sans" | "Outfit" | "Plus Jakarta Sans";
type RadiusOption = "sharp" | "soft" | "balanced" | "bold";
type SurfaceOption = "flat" | "elevated" | "glass";

interface BrandForm {
  platformName: string;
  adminTitle: string;
  appTitle: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: FontOption;
  borderRadius: RadiusOption;
  surfaceStyle: SurfaceOption;
  logoUrl: string;
  faviconUrl: string;
}

const FONTS: FontOption[] = ["system-ui", "Inter", "Poppins", "DM Sans", "Outfit", "Plus Jakarta Sans"];
const RADII: { value: RadiusOption; label: string }[] = [
  { value: "sharp", label: "Sharp" },
  { value: "soft", label: "Soft" },
  { value: "balanced", label: "Balanced" },
  { value: "bold", label: "Bold" },
];
const SURFACES: { value: SurfaceOption; label: string; desc: string }[] = [
  { value: "flat", label: "Flat", desc: "Clean, minimal surfaces" },
  { value: "elevated", label: "Elevated", desc: "Subtle depth shadows" },
  { value: "glass", label: "Glass", desc: "Blur & transparency" },
];

const PRESET_COLORS = ["#ff4d6d", "#6366f1", "#14b8a6", "#f97316", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"];

export function AdminBranding() {
  const [form, setForm] = useState<BrandForm>({
    platformName: "BROMO",
    adminTitle: "BROMO Admin",
    appTitle: "BROMO App",
    tagline: "Share your world",
    primaryColor: "#ff4d6d",
    secondaryColor: "#2a2a2a",
    fontFamily: "Inter",
    borderRadius: "bold",
    surfaceStyle: "glass",
    logoUrl: "",
    faviconUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof BrandForm>(key: K, val: BrandForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-muted-foreground mt-1 text-sm">Logos, themes, and white-label chrome for your platform.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="col-span-2 space-y-6">
          {/* Identity */}
          <div className="border-border bg-background brand-surface rounded-2xl border p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Type className="text-accent size-4" />
              <h2 className="text-foreground font-semibold">Platform identity</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["platformName", "Platform name", "BROMO"],
                ["adminTitle", "Admin panel title", "BROMO Admin"],
                ["appTitle", "App title", "BROMO App"],
                ["tagline", "Tagline", "Share your world"],
              ] as [keyof BrandForm, string, string][]).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">{label}</label>
                  <input
                    type="text"
                    value={form[key] as string}
                    onChange={(e) => update(key, e.target.value as BrandForm[keyof BrandForm])}
                    placeholder={placeholder}
                    className="border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="border-border bg-background brand-surface rounded-2xl border p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Palette className="text-accent size-4" />
              <h2 className="text-foreground font-semibold">Colors</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Primary / accent</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => update("primaryColor", c)}
                      className={cn("size-7 rounded-lg border-2 transition-transform hover:scale-110", form.primaryColor === c ? "border-foreground scale-110" : "border-transparent")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => update("primaryColor", e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-xl border-0"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => update("primaryColor", e.target.value)}
                    className="border-input bg-background text-foreground w-28 rounded-xl border px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Muted / surface</label>
                <div className="flex items-center gap-3 mt-5">
                  <input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => update("secondaryColor", e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-xl border-0"
                  />
                  <input
                    type="text"
                    value={form.secondaryColor}
                    onChange={(e) => update("secondaryColor", e.target.value)}
                    className="border-input bg-background text-foreground w-28 rounded-xl border px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="border-border bg-background brand-surface rounded-2xl border p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Type className="text-accent size-4" />
              <h2 className="text-foreground font-semibold">Typography & shape</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Font family</label>
                <div className="flex flex-wrap gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f}
                      onClick={() => update("fontFamily", f)}
                      style={{ fontFamily: f !== "system-ui" ? f : undefined }}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-sm transition-colors",
                        form.fontFamily === f ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >{f}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Border radius</label>
                <div className="flex flex-wrap gap-2">
                  {RADII.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => update("borderRadius", r.value)}
                      className={cn(
                        "border px-3 py-1.5 text-sm transition-colors",
                        r.value === "sharp" ? "rounded" : r.value === "soft" ? "rounded-lg" : r.value === "balanced" ? "rounded-xl" : "rounded-2xl",
                        form.borderRadius === r.value ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >{r.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Surface style */}
          <div className="border-border bg-background brand-surface rounded-2xl border p-6 shadow-sm">
            <h2 className="text-foreground mb-4 font-semibold">Surface style</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {SURFACES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update("surfaceStyle", s.value)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all",
                    form.surfaceStyle === s.value ? "border-accent ring-2 ring-ring bg-accent/5" : "border-border hover:bg-muted/40",
                  )}
                >
                  <p className="text-foreground font-semibold">{s.label}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview + assets */}
        <div className="space-y-6">
          {/* Preview card */}
          <div className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
            <h2 className="text-foreground mb-4 font-semibold text-sm">Live preview</h2>
            <div
              className="rounded-2xl p-5"
              style={{ background: `${form.primaryColor}18`, border: `1.5px solid ${form.primaryColor}40` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="size-8 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: form.primaryColor, color: "#fff" }}>
                  {form.platformName.slice(0, 1)}
                </div>
                <span className="font-bold text-lg" style={{ fontFamily: form.fontFamily !== "system-ui" ? form.fontFamily : undefined, color: form.primaryColor }}>
                  {form.platformName}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">{form.tagline}</p>
              <div className="mt-3 flex gap-2">
                <div className="flex-1 h-2 rounded-full" style={{ background: form.primaryColor }} />
                <div className="flex-1 h-2 rounded-full" style={{ background: form.secondaryColor }} />
              </div>
            </div>
          </div>

          {/* Assets */}
          <div className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Image className="text-accent size-4" />
              <h2 className="text-foreground font-semibold text-sm">Brand assets</h2>
            </div>
            <div className="space-y-4">
              {[
                { key: "logoUrl" as const, label: "Logo", hint: "SVG or PNG, recommended 200×60px" },
                { key: "faviconUrl" as const, label: "Favicon", hint: "ICO or PNG, 32×32px" },
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">{label}</label>
                  <div className="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-center">
                    <div className="bg-muted flex size-10 items-center justify-center rounded-xl">
                      <Image className="text-muted-foreground size-5" />
                    </div>
                    <p className="text-muted-foreground text-xs">{hint}</p>
                    <label className="border-border bg-background text-foreground cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/40">
                      Upload
                      <input type="file" accept="image/*" className="sr-only" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Save className="size-4" />
          {saving ? "Saving…" : "Save branding"}
        </button>
        {saved && <span className="text-success text-sm font-medium">Saved successfully!</span>}
      </div>
    </div>
  );
}
