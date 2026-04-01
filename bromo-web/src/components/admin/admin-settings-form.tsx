"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlatformSettings, ThemePalette } from "@/types/settings";
import { Loader2, Save, Sparkles } from "lucide-react";

type Props = {
  initial: PlatformSettings;
};

export function AdminSettingsForm({ initial }: Props) {
  const [form, setForm] = useState<PlatformSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      ...initial,
      theme: {
        ...initial.theme,
        defaultTheme:
          initial.theme.defaultTheme === "dark" ? "dark" : "light",
      },
    });
  }, [initial]);

  function updatePalette(mode: "light" | "dark", key: keyof ThemePalette, value: string) {
    setForm((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        [mode]: {
          ...prev.theme[mode],
          [key]: value,
        },
      },
    }));
  }

  function updateNested<
    K extends keyof PlatformSettings,
    IK extends keyof PlatformSettings[K] & string,
  >(rootKey: K, innerKey: IK, value: PlatformSettings[K][IK]) {
    setForm((prev) => ({
      ...prev,
      [rootKey]: {
        ...(prev[rootKey] as object),
        [innerKey]: value,
      },
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "Failed to save settings");
        return;
      }
      const data = (await res.json()) as PlatformSettings;
      setForm(data);
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  async function onUploadImage(type: "logo" | "favicon", file?: File) {
    if (!file) return;
    setUploading(type);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = await fetch("/api/admin/settings/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        message?: string;
      };
      if (!res.ok || !data.url) {
        setError(data.message ?? "Upload failed");
        return;
      }
      setForm((prev) => ({
        ...prev,
        branding: {
          ...prev.branding,
          logoUrl: type === "logo" ? data.url : prev.branding.logoUrl,
          faviconUrl: type === "favicon" ? data.url : prev.branding.faviconUrl,
        },
      }));
      setSavedAt(new Date());
    } finally {
      setUploading(null);
    }
  }

  const fontOptions = useMemo(
    () => [
      { value: "system-ui", label: "System UI" },
      { value: "Inter, sans-serif", label: "Inter" },
      { value: "Roboto, sans-serif", label: "Roboto" },
      { value: "Poppins, sans-serif", label: "Poppins" },
      { value: "Montserrat, sans-serif", label: "Montserrat" },
    ],
    [],
  );

  const colorFields: Array<{ key: keyof ThemePalette; label: string }> = [
    { key: "background", label: "Background" },
    { key: "foreground", label: "Foreground" },
    { key: "muted", label: "Muted" },
    { key: "mutedForeground", label: "Muted foreground" },
    { key: "border", label: "Border" },
    { key: "input", label: "Input" },
    { key: "ring", label: "Ring" },
    { key: "primary", label: "Primary" },
    { key: "primaryForeground", label: "Primary foreground" },
    { key: "destructive", label: "Destructive" },
    { key: "destructiveForeground", label: "Destructive foreground" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            Platform settings
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure global branding, theme tokens, security, maintenance, and feature variables
            without developer support.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-4" aria-hidden />
          <span>Concept-ready for white-label rollout</span>
        </div>
      </header>

      <form onSubmit={onSubmit} className="space-y-8">
        <section className="border-border bg-background/60 rounded-2xl border p-4 md:p-6">
          <h2 className="text-foreground mb-3 text-sm font-medium">General & branding</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium" htmlFor="platformName">
                Platform name
              </label>
              <input
                id="platformName"
                value={form.branding.platformName}
                onChange={(e) =>
                  updateNested("branding", "platformName", e.target.value)
                }
                className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium" htmlFor="adminTitle">
                Admin title
              </label>
              <input
                id="adminTitle"
                value={form.branding.adminTitle}
                onChange={(e) => updateNested("branding", "adminTitle", e.target.value)}
                className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium" htmlFor="appTitle">
                App title
              </label>
              <input
                id="appTitle"
                value={form.branding.appTitle}
                onChange={(e) => updateNested("branding", "appTitle", e.target.value)}
                className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-foreground text-xs font-medium">Logo upload</label>
              <div className="flex flex-wrap items-center gap-3">
                {form.branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.branding.logoUrl}
                    alt="Logo preview"
                    className="h-12 w-12 rounded-md border border-border object-cover"
                  />
                ) : null}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  {uploading === "logo" ? "Uploading..." : "Upload logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      void onUploadImage("logo", e.target.files?.[0] ?? undefined)
                    }
                  />
                </label>
                <span className="text-muted-foreground text-xs">
                  Stored in backend `uploads/settings`
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-foreground text-xs font-medium">Favicon upload</label>
              <div className="flex flex-wrap items-center gap-3">
                {form.branding.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.branding.faviconUrl}
                    alt="Favicon preview"
                    className="h-10 w-10 rounded border border-border object-cover"
                  />
                ) : null}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  {uploading === "favicon" ? "Uploading..." : "Upload favicon"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      void onUploadImage("favicon", e.target.files?.[0] ?? undefined)
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="border-border bg-background/60 rounded-2xl border p-4 md:p-6">
          <h2 className="text-foreground mb-3 text-sm font-medium">Theme engine</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium">Default theme</label>
              <select
                value={form.theme.defaultTheme}
                onChange={(e) =>
                  updateNested(
                    "theme",
                    "defaultTheme",
                    e.target.value as "light" | "dark",
                  )
                }
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium">Base font family</label>
              <select
                value={form.theme.fontFamily}
                onChange={(e) => updateNested("theme", "fontFamily", e.target.value)}
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              >
                {fontOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="text-foreground mt-6 inline-flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={form.theme.useGoogleFont}
                onChange={(e) => updateNested("theme", "useGoogleFont", e.target.checked)}
              />
              Use Google font family
            </label>
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium">Google font family</label>
              <input
                value={form.theme.googleFontFamily ?? ""}
                onChange={(e) => updateNested("theme", "googleFontFamily", e.target.value)}
                placeholder="Inter"
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </div>
            {(["light", "dark"] as const).map((mode) => (
              <div key={mode} className="md:col-span-2 rounded-xl border border-border p-4">
                <h3 className="text-foreground mb-3 text-sm font-medium capitalize">
                  {mode} palette
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {colorFields.map((field) => (
                    <div key={`${mode}-${field.key}`} className="space-y-1">
                      <label className="text-muted-foreground text-xs">{field.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.theme[mode][field.key]}
                          onChange={(e) => updatePalette(mode, field.key, e.target.value)}
                          className="h-8 w-9 rounded border border-border bg-transparent p-1"
                        />
                        <input
                          value={form.theme[mode][field.key]}
                          onChange={(e) => updatePalette(mode, field.key, e.target.value)}
                          className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs font-mono outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-border bg-background/60 rounded-2xl border p-4 md:p-6">
          <h2 className="text-foreground mb-3 text-sm font-medium">Operations & security</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border p-4">
              <label className="text-foreground inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={form.maintenance.admin.enabled}
                  onChange={(e) =>
                    updateNested("maintenance", "admin", {
                      ...form.maintenance.admin,
                      enabled: e.target.checked,
                    })
                  }
                />
                Admin maintenance mode
              </label>
              <input
                value={form.maintenance.admin.message}
                onChange={(e) =>
                  updateNested("maintenance", "admin", {
                    ...form.maintenance.admin,
                    message: e.target.value,
                  })
                }
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4">
              <label className="text-foreground inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={form.maintenance.app.enabled}
                  onChange={(e) =>
                    updateNested("maintenance", "app", {
                      ...form.maintenance.app,
                      enabled: e.target.checked,
                    })
                  }
                />
                App maintenance mode
              </label>
              <input
                value={form.maintenance.app.message}
                onChange={(e) =>
                  updateNested("maintenance", "app", {
                    ...form.maintenance.app,
                    message: e.target.value,
                  })
                }
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium">Admin JWT expiry</label>
              <select
                value={form.security.adminSessionTtl}
                onChange={(e) =>
                  updateNested("security", "adminSessionTtl", e.target.value)
                }
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              >
                <option value="30m">30 minutes</option>
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="8h">8 hours</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium">
                Idle timeout (minutes)
              </label>
              <input
                type="number"
                min={5}
                value={form.security.adminSessionTimeoutMinutes}
                onChange={(e) =>
                  updateNested(
                    "security",
                    "adminSessionTimeoutMinutes",
                    Number(e.target.value || 0),
                  )
                }
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
        </section>

        <section className="border-border bg-background/60 rounded-2xl border p-4 md:p-6">
          <h2 className="text-foreground mb-3 text-sm font-medium">
            White-label, features & app variables
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border p-4">
              <label className="text-foreground inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={form.whiteLabel.enabled}
                  onChange={(e) => updateNested("whiteLabel", "enabled", e.target.checked)}
                />
                Enable white-label mode
              </label>
              <label className="text-foreground inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={form.whiteLabel.allowCustomDomain}
                  onChange={(e) =>
                    updateNested("whiteLabel", "allowCustomDomain", e.target.checked)
                  }
                />
                Allow custom domain
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs">Tenant mode</label>
                  <select
                    value={form.whiteLabel.tenantMode}
                    onChange={(e) =>
                      updateNested(
                        "whiteLabel",
                        "tenantMode",
                        e.target.value as PlatformSettings["whiteLabel"]["tenantMode"],
                      )
                    }
                    className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
                  >
                    <option value="single">Single tenant</option>
                    <option value="multi">Multi tenant</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs">Default locale</label>
                  <select
                    value={form.whiteLabel.defaultLocale}
                    onChange={(e) => updateNested("whiteLabel", "defaultLocale", e.target.value)}
                    className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>
              <input
                value={form.whiteLabel.supportEmail}
                onChange={(e) => updateNested("whiteLabel", "supportEmail", e.target.value)}
                placeholder="support@platform.com"
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
              <input
                value={form.whiteLabel.companyAddress}
                onChange={(e) => updateNested("whiteLabel", "companyAddress", e.target.value)}
                placeholder="Company address"
                className="border-input bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4">
              <p className="text-foreground text-xs font-medium">Feature flags</p>
              {(
                [
                  ["analytics", "Analytics"],
                  ["support", "Support"],
                  ["notifications", "Notifications"],
                  ["billing", "Billing"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-foreground inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={form.featureFlags[key]}
                    onChange={(e) =>
                      updateNested("featureFlags", key, e.target.checked)
                    }
                  />
                  {label}
                </label>
              ))}
              <hr className="my-2 border-border" />
              <p className="text-foreground text-xs font-medium">Global app variables</p>
              <label className="text-foreground inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.variables.showRatings}
                  onChange={(e) => updateNested("variables", "showRatings", e.target.checked)}
                />
                Show ratings
              </label>
              <label className="text-foreground inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.variables.enableWaitlist}
                  onChange={(e) =>
                    updateNested("variables", "enableWaitlist", e.target.checked)
                  }
                />
                Enable waitlist
              </label>
              <input
                value={form.variables.customTagline}
                onChange={(e) => updateNested("variables", "customTagline", e.target.value)}
                placeholder="Custom tagline"
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              />
              <input
                value={form.variables.appStoreUrl}
                onChange={(e) => updateNested("variables", "appStoreUrl", e.target.value)}
                placeholder="App Store URL"
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              />
              <input
                value={form.variables.playStoreUrl}
                onChange={(e) => updateNested("variables", "playStoreUrl", e.target.value)}
                placeholder="Play Store URL"
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              />
              <input
                value={form.variables.termsUrl}
                onChange={(e) => updateNested("variables", "termsUrl", e.target.value)}
                placeholder="Terms URL"
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              />
              <input
                value={form.variables.privacyUrl}
                onChange={(e) => updateNested("variables", "privacyUrl", e.target.value)}
                placeholder="Privacy URL"
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              />
              <input
                value={form.variables.helpCenterUrl}
                onChange={(e) => updateNested("variables", "helpCenterUrl", e.target.value)}
                placeholder="Help center URL"
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              />
            </div>
          </div>
        </section>

        <section className="border-border bg-background/60 rounded-2xl border p-4 md:p-6">
          <h2 className="text-foreground mb-3 text-sm font-medium">Brand guideline controls</h2>
          <p className="text-muted-foreground mb-4 text-xs">
            Based on the client reference language: dark-first, premium contrast, bold rounded
            surfaces, chip-heavy layouts, and controlled gradients.
          </p>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Personality</label>
              <select
                value={form.brandGuidelines.personality}
                onChange={(e) =>
                  updateNested(
                    "brandGuidelines",
                    "personality",
                    e.target.value as PlatformSettings["brandGuidelines"]["personality"],
                  )
                }
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              >
                <option value="premium">Premium</option>
                <option value="neutral">Neutral</option>
                <option value="playful">Playful</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Icon style</label>
              <select
                value={form.brandGuidelines.iconStyle}
                onChange={(e) =>
                  updateNested(
                    "brandGuidelines",
                    "iconStyle",
                    e.target.value as PlatformSettings["brandGuidelines"]["iconStyle"],
                  )
                }
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              >
                <option value="rounded">Rounded</option>
                <option value="sharp">Sharp</option>
                <option value="duotone">Duotone</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Radius scale</label>
              <select
                value={form.brandGuidelines.borderRadiusScale}
                onChange={(e) =>
                  updateNested(
                    "brandGuidelines",
                    "borderRadiusScale",
                    e.target.value as PlatformSettings["brandGuidelines"]["borderRadiusScale"],
                  )
                }
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              >
                <option value="soft">Soft</option>
                <option value="balanced">Balanced</option>
                <option value="bold">Bold</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Surface style</label>
              <select
                value={form.brandGuidelines.surfaceStyle}
                onChange={(e) =>
                  updateNested(
                    "brandGuidelines",
                    "surfaceStyle",
                    e.target.value as PlatformSettings["brandGuidelines"]["surfaceStyle"],
                  )
                }
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              >
                <option value="glass">Glass</option>
                <option value="elevated">Elevated</option>
                <option value="flat">Flat</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Content density</label>
              <select
                value={form.brandGuidelines.contentDensity}
                onChange={(e) =>
                  updateNested(
                    "brandGuidelines",
                    "contentDensity",
                    e.target.value as PlatformSettings["brandGuidelines"]["contentDensity"],
                  )
                }
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Motion intensity</label>
              <select
                value={form.brandGuidelines.motionIntensity}
                onChange={(e) =>
                  updateNested(
                    "brandGuidelines",
                    "motionIntensity",
                    e.target.value as PlatformSettings["brandGuidelines"]["motionIntensity"],
                  )
                }
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              >
                <option value="none">None</option>
                <option value="subtle">Subtle</option>
                <option value="expressive">Expressive</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Heading case</label>
              <select
                value={form.brandGuidelines.headingCase}
                onChange={(e) =>
                  updateNested(
                    "brandGuidelines",
                    "headingCase",
                    e.target.value as PlatformSettings["brandGuidelines"]["headingCase"],
                  )
                }
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              >
                <option value="uppercase">Uppercase</option>
                <option value="title">Title</option>
                <option value="sentence">Sentence</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs">Gradient style</label>
              <select
                value={form.brandGuidelines.gradientStyle}
                onChange={(e) =>
                  updateNested(
                    "brandGuidelines",
                    "gradientStyle",
                    e.target.value as PlatformSettings["brandGuidelines"]["gradientStyle"],
                  )
                }
                className="border-input bg-background text-foreground w-full rounded border px-2 py-1.5 text-xs outline-none"
              >
                <option value="vibrant">Vibrant</option>
                <option value="subtle">Subtle</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm transition-colors hover:bg-foreground/90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {saving ? "Saving…" : "Save changes"}
          </button>
          {savedAt ? (
            <p className="text-muted-foreground text-xs">
              Last saved at {savedAt.toLocaleTimeString()}
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}

