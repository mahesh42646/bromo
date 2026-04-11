"use client";

import { useState } from "react";
import { Activity, ArrowUpRight, TrendingDown, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const DAU_DATA = [820, 940, 870, 1100, 980, 1240, 1310, 1180, 1420, 1560, 1390, 1680, 1720, 1850];
const MONTHLY = [
  { month: "Jan", users: 4200, sessions: 18400, posts: 3100 },
  { month: "Feb", users: 5100, sessions: 22000, posts: 3800 },
  { month: "Mar", users: 6300, sessions: 27500, posts: 4900 },
  { month: "Apr", users: 7800, sessions: 34200, posts: 6100 },
  { month: "May", users: 9200, sessions: 40800, posts: 7400 },
  { month: "Jun", users: 10500, sessions: 46000, posts: 8200 },
];

function MiniBar({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values);
  return (
    <div className="flex h-16 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("min-w-[4px] flex-1 rounded-t-sm opacity-80", color)}
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function BarChart({ data }: { data: typeof MONTHLY }) {
  const max = Math.max(...data.map((d) => d.sessions));
  return (
    <div className="mt-4 flex h-40 items-end gap-3">
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full flex-1 flex items-end">
            <div
              className="bg-accent/70 w-full rounded-t-lg transition-all hover:bg-accent"
              style={{ height: `${(d.sessions / max) * 100}%` }}
            />
          </div>
          <span className="text-muted-foreground text-[11px]">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

const RETENTION = [
  { cohort: "Apr 2026", w1: 82, w2: 61, w3: 48, w4: 39 },
  { cohort: "Mar 2026", w1: 79, w2: 58, w3: 44, w4: 36 },
  { cohort: "Feb 2026", w1: 76, w2: 55, w3: 41, w4: 33 },
  { cohort: "Jan 2026", w1: 74, w2: 52, w3: 38, w4: 31 },
];

const FUNNELS = [
  { step: "App open", count: 12400, pct: 100 },
  { step: "Sign up", count: 4960, pct: 40 },
  { step: "Onboarding complete", count: 3472, pct: 28 },
  { step: "First post", count: 1984, pct: 16 },
  { step: "D7 retention", count: 992, pct: 8 },
];

const TOP_CONTENT = [
  { type: "Reel", title: "Dance challenge #viral", views: "142K", likes: "18K" },
  { type: "Story", title: "Morning routine series", views: "89K", likes: "12K" },
  { type: "Post", title: "Product launch announcement", views: "54K", likes: "9K" },
  { type: "Reel", title: "Travel vlog compilation", views: "48K", likes: "7K" },
  { type: "Post", title: "Community Q&A thread", views: "31K", likes: "5K" },
];

type Range = "7d" | "30d" | "90d";

export function AdminAnalytics() {
  const [range, setRange] = useState<Range>("30d");

  const stats = [
    { label: "Monthly active users", value: "10,500", change: "+14.1%", up: true, icon: Users },
    { label: "Daily active users", value: "1,850", change: "+8.7%", up: true, icon: Activity },
    { label: "Avg. session length", value: "4m 32s", change: "+2.3%", up: true, icon: TrendingUp },
    { label: "Churn rate", value: "3.2%", change: "-0.4%", up: false, icon: TrendingDown },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">Product funnels, engagement metrics, and cohort analysis.</p>
        </div>
        <div className="border-border bg-muted/40 flex rounded-xl border p-1">
          {(["7d", "30d", "90d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, change, up, icon: Icon }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <div className="text-muted-foreground flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              <Icon className="size-4 opacity-60" />
            </div>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", up ? "text-success" : "text-destructive")}>
              {up ? <ArrowUpRight className="size-3" /> : <TrendingDown className="size-3" />}
              {change} vs prev period
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* DAU Chart */}
        <div className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
          <h2 className="text-foreground mb-1 font-semibold">Daily active users</h2>
          <p className="text-muted-foreground mb-4 text-xs">Last 14 days</p>
          <MiniBar values={DAU_DATA} color="bg-accent" />
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>14 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Monthly sessions */}
        <div className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
          <h2 className="text-foreground mb-1 font-semibold">Sessions per month</h2>
          <p className="text-muted-foreground mb-2 text-xs">Jan – Jun 2026</p>
          <BarChart data={MONTHLY} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <div className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
          <h2 className="text-foreground mb-4 font-semibold">Acquisition funnel</h2>
          <div className="space-y-2">
            {FUNNELS.map((step, i) => (
              <div key={step.step}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{step.step}</span>
                  <span className="text-muted-foreground">{step.count.toLocaleString()} · {step.pct}%</span>
                </div>
                <div className="bg-muted h-2 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", i === 0 ? "bg-accent" : "bg-accent/60")}
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retention */}
        <div className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
          <h2 className="text-foreground mb-4 font-semibold">Retention cohorts</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-muted-foreground pb-2 text-left text-xs font-medium">Cohort</th>
                  {["W1", "W2", "W3", "W4"].map((w) => (
                    <th key={w} className="text-muted-foreground pb-2 text-center text-xs font-medium">{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {RETENTION.map((row) => (
                  <tr key={row.cohort}>
                    <td className="text-foreground py-2 text-xs font-medium">{row.cohort}</td>
                    {[row.w1, row.w2, row.w3, row.w4].map((v, i) => (
                      <td key={i} className="py-2 text-center">
                        <span
                          className="inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-semibold"
                          style={{ background: `rgba(255, 77, 109, ${v / 100 * 0.35})`, color: v > 50 ? "var(--accent)" : "var(--foreground-muted)" }}
                        >
                          {v}%
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top content */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground font-semibold">Top performing content</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["#", "Type", "Content", "Views", "Likes"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {TOP_CONTENT.map((c, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="text-muted-foreground px-5 py-3 tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3">
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">{c.type}</span>
                  </td>
                  <td className="text-foreground px-5 py-3 font-medium">{c.title}</td>
                  <td className="text-foreground px-5 py-3 tabular-nums">{c.views}</td>
                  <td className="text-foreground px-5 py-3 tabular-nums">{c.likes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
