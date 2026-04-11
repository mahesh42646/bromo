"use client";

import { useState } from "react";
import { Flag, Info, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  rollout: number; // 0-100 percentage
  audience: "all" | "beta" | "staff" | "custom";
  environment: "production" | "staging" | "dev";
  locked?: boolean;
  tag: "core" | "billing" | "engagement" | "experiment";
}

const INITIAL_FLAGS: FeatureFlag[] = [
  { id: "1", name: "Analytics dashboard", key: "analytics", description: "Enable product analytics for all admin areas.", enabled: true, rollout: 100, audience: "all", environment: "production", locked: true, tag: "core" },
  { id: "2", name: "Support tickets", key: "support", description: "Activate the in-app support ticket system.", enabled: true, rollout: 100, audience: "all", environment: "production", tag: "engagement" },
  { id: "3", name: "Push notifications", key: "notifications", description: "Allow the platform to send push notifications to users.", enabled: true, rollout: 100, audience: "all", environment: "production", tag: "engagement" },
  { id: "4", name: "Billing & subscriptions", key: "billing", description: "Enable in-app purchases and subscription management.", enabled: false, rollout: 0, audience: "beta", environment: "staging", tag: "billing" },
  { id: "5", name: "Creator monetization", key: "creator_monetization", description: "Allow verified creators to earn from their content.", enabled: false, rollout: 0, audience: "staff", environment: "staging", tag: "billing" },
  { id: "6", name: "Stories v3", key: "stories_v3", description: "Next-gen ephemeral content format with AR filters.", enabled: true, rollout: 20, audience: "beta", environment: "production", tag: "experiment" },
  { id: "7", name: "Live streaming", key: "live_stream", description: "Real-time video broadcasting for verified accounts.", enabled: false, rollout: 0, audience: "staff", environment: "dev", tag: "experiment" },
  { id: "8", name: "AI content moderation", key: "ai_moderation", description: "Automated content moderation using ML models.", enabled: true, rollout: 50, audience: "all", environment: "production", tag: "core" },
];

const TAG_STYLES: Record<FeatureFlag["tag"], string> = {
  core: "bg-accent/15 text-accent",
  billing: "bg-warning/15 text-warning",
  engagement: "bg-success/15 text-success",
  experiment: "bg-muted text-muted-foreground",
};

const ENV_STYLES: Record<FeatureFlag["environment"], string> = {
  production: "bg-destructive/15 text-destructive",
  staging: "bg-warning/15 text-warning",
  dev: "bg-muted text-muted-foreground",
};

export function AdminFeatureFlags() {
  const [flags, setFlags] = useState(INITIAL_FLAGS);
  const [filterTag, setFilterTag] = useState<FeatureFlag["tag"] | "">("");
  const [filterEnv, setFilterEnv] = useState<FeatureFlag["environment"] | "">("");

  function toggle(id: string) {
    setFlags((prev) => prev.map((f) => f.id === id && !f.locked ? { ...f, enabled: !f.enabled, rollout: !f.enabled ? 100 : 0 } : f));
  }

  function setRollout(id: string, pct: number) {
    setFlags((prev) => prev.map((f) => f.id === id ? { ...f, rollout: pct } : f));
  }

  const visible = flags.filter((f) => {
    if (filterTag && f.tag !== filterTag) return false;
    if (filterEnv && f.environment !== filterEnv) return false;
    return true;
  });

  const stats = [
    { label: "Enabled flags", value: flags.filter((f) => f.enabled).length },
    { label: "Disabled flags", value: flags.filter((f) => !f.enabled).length },
    { label: "Experiments", value: flags.filter((f) => f.tag === "experiment").length },
    { label: "Partial rollout", value: flags.filter((f) => f.rollout > 0 && f.rollout < 100).length },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Feature flags</h1>
        <p className="text-muted-foreground mt-1 text-sm">Progressive delivery, kill switches, and audience targeting.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value as FeatureFlag["tag"] | "")}
          className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All tags</option>
          <option value="core">Core</option>
          <option value="billing">Billing</option>
          <option value="engagement">Engagement</option>
          <option value="experiment">Experiment</option>
        </select>
        <select
          value={filterEnv}
          onChange={(e) => setFilterEnv(e.target.value as FeatureFlag["environment"] | "")}
          className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All environments</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="dev">Dev</option>
        </select>
      </div>

      {/* Flags */}
      <div className="space-y-3">
        {visible.map((flag) => (
          <div key={flag.id} className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Flag className="text-muted-foreground size-4 shrink-0" />
                  <span className="text-foreground font-semibold">{flag.name}</span>
                  <code className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">{flag.key}</code>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TAG_STYLES[flag.tag])}>{flag.tag}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ENV_STYLES[flag.environment])}>{flag.environment}</span>
                  {flag.locked && <Lock className="text-muted-foreground size-3.5" />}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{flag.description}</p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggle(flag.id)}
                disabled={flag.locked}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  flag.enabled ? "bg-success" : "bg-muted",
                  flag.locked && "cursor-not-allowed opacity-50",
                )}
                aria-label={`Toggle ${flag.name}`}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                  flag.enabled && "translate-x-5",
                )} />
              </button>
            </div>

            {/* Rollout */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                  <Users className="size-3" />
                  Rollout
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-muted h-1.5 flex-1 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", flag.enabled ? "bg-success" : "bg-muted-foreground/30")}
                      style={{ width: `${flag.rollout}%` }}
                    />
                  </div>
                  <span className="text-foreground w-8 text-right text-xs font-semibold tabular-nums">{flag.rollout}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={flag.rollout}
                  disabled={!flag.enabled || flag.locked}
                  onChange={(e) => setRollout(flag.id, parseInt(e.target.value, 10))}
                  className="mt-1 w-full disabled:opacity-40"
                />
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">Audience</p>
                <p className="text-foreground text-sm font-medium capitalize">{flag.audience}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide">
                  <Info className="size-3" /> Status
                </p>
                <p className={cn("text-sm font-medium", flag.enabled ? "text-success" : "text-muted-foreground")}>
                  {flag.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
