"use client";

import { useState } from "react";
import { Flag, Plus, Target, TrendingUp, Users, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CampaignStatus = "active" | "draft" | "scheduled" | "ended";
type CampaignType = "push" | "email" | "in_app" | "multi_channel";

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  audience: string;
  reach: number;
  conversions: number;
  startDate: string;
  endDate: string;
}

const CAMPAIGNS: Campaign[] = [
  { id: "1", name: "Spring onboarding push", type: "push", status: "active", audience: "New users (7d)", reach: 1240, conversions: 186, startDate: "2026-04-01", endDate: "2026-04-30" },
  { id: "2", name: "Re-engagement email series", type: "email", status: "active", audience: "Inactive 14d+", reach: 3200, conversions: 384, startDate: "2026-03-15", endDate: "2026-04-15" },
  { id: "3", name: "Creator launch campaign", type: "multi_channel", status: "scheduled", audience: "Verified creators", reach: 0, conversions: 0, startDate: "2026-04-15", endDate: "2026-05-01" },
  { id: "4", name: "Premium upgrade nudge", type: "in_app", status: "draft", audience: "Free tier users", reach: 0, conversions: 0, startDate: "2026-04-20", endDate: "2026-05-20" },
  { id: "5", name: "Valentine's day special", type: "push", status: "ended", audience: "All users", reach: 9800, conversions: 1470, startDate: "2026-02-12", endDate: "2026-02-15" },
];

const STATUS_STYLES: Record<CampaignStatus, string> = {
  active: "bg-success/15 text-success",
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-accent/15 text-accent",
  ended: "bg-border text-muted-foreground",
};

const TYPE_LABEL: Record<CampaignType, string> = {
  push: "Push",
  email: "Email",
  in_app: "In-app",
  multi_channel: "Multi-channel",
};

function NewCampaignModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-overlay fixed inset-0" onClick={onClose} />
      <div className="border-border bg-background brand-surface relative w-full max-w-lg rounded-2xl border p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-foreground font-semibold">New campaign</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Campaign name</label>
            <input type="text" placeholder="e.g. Spring re-engagement" className="border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Channel</label>
              <select className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option>Push notification</option>
                <option>Email</option>
                <option>In-app</option>
                <option>Multi-channel</option>
              </select>
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Audience</label>
              <select className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option>All users</option>
                <option>New users</option>
                <option>Active users</option>
                <option>Inactive users</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Start date</label>
              <input type="date" className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">End date</label>
              <input type="date" className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="border-border bg-muted/40 text-foreground flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium">Save as draft</button>
            <button className="bg-accent text-accent-foreground flex-1 rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90">Create & schedule</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCampaigns() {
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<CampaignStatus | "">("");

  const campaigns = filter ? CAMPAIGNS.filter((c) => c.status === filter) : CAMPAIGNS;
  const totalReach = CAMPAIGNS.reduce((s, c) => s + c.reach, 0);
  const totalConversions = CAMPAIGNS.reduce((s, c) => s + c.conversions, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1 text-sm">Lifecycle campaigns, audience targeting, and growth experiments.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          <Plus className="size-4" />
          New campaign
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Active campaigns", value: CAMPAIGNS.filter((c) => c.status === "active").length, icon: Flag, color: "text-success" },
          { label: "Total reach", value: totalReach.toLocaleString(), icon: Users, color: "text-accent" },
          { label: "Conversions", value: totalConversions.toLocaleString(), icon: Target, color: "text-foreground" },
          { label: "Avg. CVR", value: totalReach ? `${((totalConversions / totalReach) * 100).toFixed(1)}%` : "—", icon: TrendingUp, color: "text-success" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <div className="text-muted-foreground flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              <Icon className={cn("size-4 opacity-70", color)} />
            </div>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["", "active", "scheduled", "draft", "ended"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s as CampaignStatus | "")}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === s
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => {
          const cvr = c.reach ? ((c.conversions / c.reach) * 100).toFixed(1) : null;
          return (
            <div key={c.id} className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">{TYPE_LABEL[c.type]}</span>
                  <h3 className="text-foreground mt-2 font-semibold">{c.name}</h3>
                  <p className="text-muted-foreground text-xs">{c.audience}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[c.status])}>
                  {c.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Reach</p>
                  <p className="text-foreground mt-0.5 font-semibold tabular-nums">{c.reach.toLocaleString() || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Conversions</p>
                  <p className="text-foreground mt-0.5 font-semibold tabular-nums">{c.conversions.toLocaleString() || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">CVR</p>
                  <p className={cn("mt-0.5 font-semibold tabular-nums", cvr ? "text-success" : "text-muted-foreground")}>
                    {cvr ? `${cvr}%` : "—"}
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-xs">{c.startDate} → {c.endDate}</p>
            </div>
          );
        })}
      </div>

      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
