"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Megaphone,
  MonitorPlay,
  PanelRight,
  Pause,
  Play,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdStatus = "draft" | "active" | "paused" | "archived";
type AdType = "image" | "carousel" | "video";
type AdPlacement = "feed" | "reels" | "stories" | "explore";
type AdActionType = "external_url" | "in_app";

interface AdCta {
  label: string;
  actionType: AdActionType;
  externalUrl?: string;
  inAppScreen?: string;
  inAppParams?: Record<string, unknown>;
}

interface Ad {
  _id: string;
  title: string;
  status: AdStatus;
  adType: AdType;
  mediaUrls: string[];
  thumbnailUrl: string;
  caption: string;
  cta: AdCta;
  placements: AdPlacement[];
  startDate: string;
  endDate?: string;
  priority: number;
  totalImpressions: number;
  totalClicks: number;
  totalVideoViews: number;
  totalVideoCompletions: number;
  createdAt: string;
}

interface AdAnalytics {
  summary: {
    totalImpressions: number;
    totalClicks: number;
    ctr: number;
    totalVideoViews: number;
    totalVideoCompletions: number;
    completionRate: number;
    avgWatchTimeMs: number;
  };
  byPlacement: Record<string, { impressions: number; clicks: number }>;
  dailyBreakdown: { date: string; impressions: number; clicks: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<AdStatus, string> = {
  active: "bg-success/15 text-success",
  draft: "bg-muted text-muted-foreground",
  paused: "bg-accent/15 text-accent",
  archived: "bg-border text-muted-foreground",
};

const TYPE_ICON: Record<AdType, React.ReactNode> = {
  image: <ImageIcon className="size-3.5" />,
  carousel: <ChevronRight className="size-3.5" />,
  video: <MonitorPlay className="size-3.5" />,
};

const PLACEMENTS: AdPlacement[] = ["feed", "reels", "stories", "explore"];

const IN_APP_SCREENS = [
  "Home", "Search", "Reels", "Store", "Profile", "StoreNearbyHome",
  "ExploreHome", "CreatorDashboard", "MyStoreDashboard",
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

interface AdFormData {
  title: string;
  adType: AdType;
  mediaUrls: string[];
  thumbnailUrl: string;
  caption: string;
  cta: AdCta;
  placements: AdPlacement[];
  startDate: string;
  endDate: string;
  priority: number;
  publishNow: boolean;
}

const emptyForm = (): AdFormData => ({
  title: "",
  adType: "image",
  mediaUrls: [""],
  thumbnailUrl: "",
  caption: "",
  cta: { label: "Learn More", actionType: "external_url", externalUrl: "" },
  placements: ["feed"],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  priority: 1,
  publishNow: true,
});

function AdFormModal({
  ad,
  onClose,
  onSaved,
}: {
  ad?: Ad;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AdFormData>(() =>
    ad
      ? {
          title: ad.title,
          adType: ad.adType,
          mediaUrls: ad.mediaUrls,
          thumbnailUrl: ad.thumbnailUrl,
          caption: ad.caption,
          cta: ad.cta,
          placements: ad.placements,
          startDate: ad.startDate.slice(0, 10),
          endDate: ad.endDate?.slice(0, 10) ?? "",
          priority: ad.priority,
          publishNow: false,
        }
      : emptyForm(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof AdFormData>(key: K, val: AdFormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setCta = <K extends keyof AdCta>(key: K, val: AdCta[K]) =>
    setForm((f) => ({ ...f, cta: { ...f.cta, [key]: val } }));

  const togglePlacement = (p: AdPlacement) =>
    set(
      "placements",
      form.placements.includes(p) ? form.placements.filter((x) => x !== p) : [...form.placements, p],
    );

  const setMediaUrl = (i: number, v: string) => {
    const next = [...form.mediaUrls];
    next[i] = v;
    set("mediaUrls", next);
  };

  const addMediaUrl = () => {
    if (form.mediaUrls.length < 10) set("mediaUrls", [...form.mediaUrls, ""]);
  };

  const removeMediaUrl = (i: number) => {
    if (form.mediaUrls.length > 1) set("mediaUrls", form.mediaUrls.filter((_, idx) => idx !== i));
  };

  async function save() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (!form.mediaUrls[0]?.trim()) { setError("At least one media URL is required"); return; }
    if (!form.cta.label.trim()) { setError("CTA label is required"); return; }
    if (!form.placements.length) { setError("Select at least one placement"); return; }

    setSaving(true);
    setError("");
    try {
      const { publishNow, ...rest } = form;
      const body: Record<string, unknown> = {
        ...rest,
        mediaUrls: form.mediaUrls.filter((u) => u.trim()),
        endDate: form.endDate || undefined,
      };
      // Only set status on create (edit keeps existing status)
      if (!ad) body.status = publishNow ? "active" : "draft";
      const url = ad ? `/api/admin/ads/${ad._id}` : "/api/admin/ads";
      const res = await fetch(url, {
        method: ad ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(d.message ?? "Failed to save ad");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-overlay fixed inset-0" onClick={onClose} />
      <div className="border-border bg-background brand-surface relative w-full max-w-xl rounded-2xl border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-foreground font-semibold">{ad ? "Edit ad" : "Create ad"}</h3>
            <p className="text-muted-foreground text-xs">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1">
            <X className="size-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="border-border flex gap-1 border-b px-6 py-3">
          {["Creative", "CTA", "Placement & Schedule"].map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i + 1)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                step === i + 1
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto px-6 py-5" style={{ maxHeight: "60vh" }}>
          {error && (
            <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">{error}</p>
          )}

          {step === 1 && (
            <>
              <Field label="Ad title (internal)">
                <input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Summer sale — carousel"
                  className={inputCls}
                />
              </Field>
              <Field label="Ad type">
                <div className="flex gap-2">
                  {(["image", "carousel", "video"] as AdType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        set("adType", t);
                        if (t !== "carousel") set("mediaUrls", [form.mediaUrls[0] ?? ""]);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                        form.adType === t
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {TYPE_ICON[t]}
                      <span className="capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={form.adType === "carousel" ? "Media URLs (1–10 images)" : "Media URL"}>
                <div className="space-y-2">
                  {form.mediaUrls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={url}
                        onChange={(e) => setMediaUrl(i, e.target.value)}
                        placeholder="https://..."
                        className={cn(inputCls, "flex-1")}
                      />
                      {form.adType === "carousel" && form.mediaUrls.length > 1 && (
                        <button onClick={() => removeMediaUrl(i)} className="text-muted-foreground hover:text-destructive">
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {form.adType === "carousel" && form.mediaUrls.length < 10 && (
                    <button onClick={addMediaUrl} className="text-accent flex items-center gap-1 text-sm">
                      <Plus className="size-3.5" /> Add image
                    </button>
                  )}
                </div>
              </Field>
              {form.adType === "video" && (
                <Field label="Thumbnail URL">
                  <input
                    value={form.thumbnailUrl}
                    onChange={(e) => set("thumbnailUrl", e.target.value)}
                    placeholder="https://..."
                    className={inputCls}
                  />
                </Field>
              )}
              <Field label="Caption">
                <textarea
                  value={form.caption}
                  onChange={(e) => set("caption", e.target.value)}
                  placeholder="Ad copy shown below the media..."
                  rows={3}
                  className={cn(inputCls, "resize-none")}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="CTA button label">
                <input
                  value={form.cta.label}
                  onChange={(e) => setCta("label", e.target.value)}
                  placeholder="e.g. Shop Now"
                  className={inputCls}
                />
              </Field>
              <Field label="Action type">
                <div className="flex gap-2">
                  {(["external_url", "in_app"] as AdActionType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCta("actionType", t)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                        form.cta.actionType === t
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t === "external_url" ? "External URL" : "In-app screen"}
                    </button>
                  ))}
                </div>
              </Field>
              {form.cta.actionType === "external_url" ? (
                <Field label="External URL">
                  <input
                    value={form.cta.externalUrl ?? ""}
                    onChange={(e) => setCta("externalUrl", e.target.value)}
                    placeholder="https://example.com/landing"
                    className={inputCls}
                  />
                </Field>
              ) : (
                <>
                  <Field label="App screen">
                    <select
                      value={form.cta.inAppScreen ?? ""}
                      onChange={(e) => setCta("inAppScreen", e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select screen…</option>
                      {IN_APP_SCREENS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Placements">
                <div className="flex flex-wrap gap-2">
                  {PLACEMENTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlacement(p)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors",
                        form.placements.includes(p)
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Start date">
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="End date (optional)">
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set("endDate", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label={`Priority: ${form.priority}`}>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={form.priority}
                  onChange={(e) => set("priority", parseInt(e.target.value))}
                  className="w-full accent-[hsl(var(--accent))]"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                  <span>1 — low</span>
                  <span>10 — highest</span>
                </div>
              </Field>

              {/* Publish toggle — only shown on create */}
              {!ad && (
                <button
                  type="button"
                  onClick={() => set("publishNow", !form.publishNow)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors",
                    form.publishNow
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--accent))]"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <span className="font-medium">
                    {form.publishNow ? "Activate immediately" : "Save as draft"}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border-2 transition-colors",
                      form.publishNow ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]" : "border-border",
                    )}
                  >
                    {form.publishNow && (
                      <svg viewBox="0 0 12 12" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-border flex items-center justify-between border-t px-6 py-4">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="text-muted-foreground disabled:opacity-30 flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" /> Back
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="border-border text-muted-foreground hover:text-foreground rounded-xl border px-4 py-2 text-sm">
              Cancel
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="bg-accent text-accent-foreground flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                Next <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                onClick={save}
                disabled={saving}
                className="bg-accent text-accent-foreground rounded-xl px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : ad ? "Save changes" : form.publishNow ? "Publish ad" : "Save draft"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Drawer ─────────────────────────────────────────────────────────

function AnalyticsDrawer({ ad, onClose, onStatusChange }: { ad: Ad; onClose: () => void; onStatusChange: () => void }) {
  const [analytics, setAnalytics] = useState<AdAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/ads/${ad._id}/analytics`)
      .then((r) => r.json())
      .then((d) => setAnalytics(d as AdAnalytics))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [ad._id]);

  const maxBarVal = analytics
    ? Math.max(...analytics.dailyBreakdown.map((d) => d.impressions), 1)
    : 1;

  async function toggleStatus() {
    setToggling(true);
    const next = ad.status === "active" ? "paused" : "active";
    await fetch(`/api/admin/ads/${ad._id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setToggling(false);
    onStatusChange();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="bg-overlay fixed inset-0" onClick={onClose} />
      <div className="border-border bg-background relative flex h-full w-full max-w-lg flex-col border-l shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-start justify-between border-b px-6 py-5">
          <div>
            <h3 className="text-foreground font-semibold">{ad.title}</h3>
            <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[ad.status])}>
              {ad.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleStatus}
              disabled={toggling || ad.status === "archived" || ad.status === "draft"}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40",
                ad.status === "active"
                  ? "border-border border text-muted-foreground hover:text-foreground"
                  : "bg-success/15 text-success",
              )}
            >
              {ad.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {ad.status === "active" ? "Pause" : "Activate"}
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="border-accent size-8 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}

          {analytics && (
            <>
              {/* KPI summary */}
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Impressions" value={fmt(analytics.summary.totalImpressions)} />
                <KpiCard label="Clicks" value={fmt(analytics.summary.totalClicks)} />
                <KpiCard label="CTR" value={`${analytics.summary.ctr}%`} />
                <KpiCard label="Video views" value={fmt(analytics.summary.totalVideoViews)} />
                <KpiCard label="Completion rate" value={`${analytics.summary.completionRate}%`} />
                <KpiCard label="Avg watch" value={`${(analytics.summary.avgWatchTimeMs / 1000).toFixed(1)}s`} />
              </div>

              {/* Daily chart */}
              {analytics.dailyBreakdown.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                    Impressions — last 30 days
                  </p>
                  <div className="flex h-24 items-end gap-0.5">
                    {analytics.dailyBreakdown.map((d) => (
                      <div
                        key={d.date}
                        title={`${d.date}: ${d.impressions} impressions`}
                        style={{ height: `${Math.round((d.impressions / maxBarVal) * 100)}%` }}
                        className="bg-accent/60 hover:bg-accent min-h-[2px] flex-1 rounded-t transition-colors"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* By placement */}
              {Object.keys(analytics.byPlacement).length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">By placement</p>
                  <div className="space-y-2">
                    {Object.entries(analytics.byPlacement).map(([placement, v]) => (
                      <div key={placement} className="border-border flex items-center justify-between rounded-xl border px-4 py-2.5">
                        <span className="text-foreground text-sm capitalize">{placement}</span>
                        <div className="text-muted-foreground flex gap-4 text-sm">
                          <span>{fmt(v.impressions)} imp</span>
                          <span>{fmt(v.clicks)} clicks</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="brand-surface border-border rounded-xl border px-4 py-3">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="text-foreground mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function AdminAds({ initialAds = [] }: { initialAds?: Ad[] }) {
  const [ads, setAds] = useState<Ad[]>(initialAds);
  const [statusFilter, setStatusFilter] = useState<AdStatus | "all">("all");
  const [loading, setLoading] = useState(initialAds.length === 0);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | undefined>();
  const [analyticsAd, setAnalyticsAd] = useState<Ad | undefined>();

  const fetchAds = useCallback(async () => {
    setLoading(true);
    const q = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const res = await fetch(`/api/admin/ads${q}`).catch(() => null);
    if (res?.ok) {
      const d = await res.json() as { ads: Ad[] };
      setAds(d.ads ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { void fetchAds(); }, [fetchAds]);

  const statuses: (AdStatus | "all")[] = ["all", "active", "draft", "paused", "archived"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-accent/10 flex size-10 items-center justify-center rounded-xl">
            <Megaphone className="text-accent size-5" />
          </div>
          <div>
            <h1 className="text-foreground text-lg font-semibold">Ads manager</h1>
            <p className="text-muted-foreground text-sm">{ads.length} total ads</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          <Plus className="size-4" /> Create ad
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors capitalize",
              statusFilter === s
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="border-accent size-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : ads.length === 0 ? (
        <div className="brand-surface border-border flex flex-col items-center gap-3 rounded-2xl border py-16 text-center">
          <Megaphone className="text-muted-foreground/40 size-12" />
          <p className="text-foreground font-medium">No ads yet</p>
          <p className="text-muted-foreground text-sm">Create your first ad to get started</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-accent text-accent-foreground mt-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Create ad
          </button>
        </div>
      ) : (
        <div className="brand-surface border-border rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">Ad</th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide hidden sm:table-cell">Placements</th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium uppercase tracking-wide hidden md:table-cell">Impressions</th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium uppercase tracking-wide hidden md:table-cell">CTR</th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {ads.map((ad) => {
                const ctr = ad.totalImpressions > 0
                  ? ((ad.totalClicks / ad.totalImpressions) * 100).toFixed(2)
                  : "0.00";
                return (
                  <tr key={ad._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                          {ad.mediaUrls[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ad.mediaUrls[0]} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageIcon className="text-muted-foreground size-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-foreground truncate font-medium">{ad.title}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[ad.status])}>
                              {ad.status}
                            </span>
                            <span className="text-muted-foreground flex items-center gap-0.5 text-xs capitalize">
                              {TYPE_ICON[ad.adType]}
                              {ad.adType}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {fmtDate(ad.startDate)}{ad.endDate ? ` → ${fmtDate(ad.endDate)}` : " · No end"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {ad.placements.map((p) => (
                          <span key={p} className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs capitalize">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-foreground px-4 py-3 text-right hidden md:table-cell">
                      {fmt(ad.totalImpressions)}
                    </td>
                    <td className="text-foreground px-4 py-3 text-right hidden md:table-cell">
                      {ctr}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAnalyticsAd(ad)}
                          title="View analytics"
                          className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
                        >
                          <BarChart3 className="size-4" />
                        </button>
                        <button
                          onClick={() => { setEditingAd(ad); setShowCreate(true); }}
                          title="Edit"
                          className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
                        >
                          <PanelRight className="size-4" />
                        </button>
                        <a
                          href={ad.cta?.externalUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open CTA link"
                          className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <AdFormModal
          ad={editingAd}
          onClose={() => { setShowCreate(false); setEditingAd(undefined); }}
          onSaved={fetchAds}
        />
      )}
      {analyticsAd && (
        <AnalyticsDrawer
          ad={analyticsAd}
          onClose={() => setAnalyticsAd(undefined)}
          onStatusChange={() => { void fetchAds(); setAnalyticsAd((a) => a ? { ...a, status: a.status === "active" ? "paused" : "active" } : a); }}
        />
      )}
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
