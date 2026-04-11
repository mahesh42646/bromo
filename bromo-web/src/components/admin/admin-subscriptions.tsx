"use client";

import { useState } from "react";
import { Activity, ArrowUpRight, TrendingDown, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type SubStatus = "active" | "trialing" | "past_due" | "cancelled" | "paused";

interface Subscription {
  id: string;
  user: string;
  email: string;
  plan: string;
  interval: "monthly" | "annual";
  amount: string;
  status: SubStatus;
  startDate: string;
  renewalDate: string | null;
  cancelledAt: string | null;
}

const SUBS: Subscription[] = [
  { id: "sub_001", user: "Alex Johnson", email: "alex@example.com", plan: "Pro", interval: "monthly", amount: "₹299/mo", status: "active", startDate: "2026-01-15", renewalDate: "2026-05-15", cancelledAt: null },
  { id: "sub_002", user: "Emma Davis", email: "emma@example.com", plan: "Pro", interval: "annual", amount: "₹2,399/yr", status: "active", startDate: "2026-04-04", renewalDate: "2027-04-04", cancelledAt: null },
  { id: "sub_003", user: "James Wilson", email: "james@example.com", plan: "Pro", interval: "annual", amount: "₹2,399/yr", status: "active", startDate: "2026-03-01", renewalDate: "2027-03-01", cancelledAt: null },
  { id: "sub_004", user: "Sofia Chen", email: "sofia@example.com", plan: "Pro", interval: "monthly", amount: "₹299/mo", status: "past_due", startDate: "2026-02-20", renewalDate: "2026-04-20", cancelledAt: null },
  { id: "sub_005", user: "Tom Brown", email: "tom@example.com", plan: "Pro", interval: "monthly", amount: "₹299/mo", status: "trialing", startDate: "2026-04-01", renewalDate: "2026-04-14", cancelledAt: null },
  { id: "sub_006", user: "Maria Garcia", email: "maria@example.com", plan: "Pro", interval: "monthly", amount: "₹299/mo", status: "cancelled", startDate: "2026-01-01", renewalDate: null, cancelledAt: "2026-04-06" },
];

const STATUS_STYLES: Record<SubStatus, string> = {
  active: "bg-success/15 text-success",
  trialing: "bg-accent/15 text-accent",
  past_due: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  paused: "bg-warning/15 text-warning",
};

const PLANS = [
  { name: "Bromo Pro Monthly", price: "₹299", period: "/month", subs: SUBS.filter((s) => s.interval === "monthly" && s.status === "active").length, mrr: "₹897" },
  { name: "Bromo Pro Annual", price: "₹2,399", period: "/year", subs: SUBS.filter((s) => s.interval === "annual" && s.status === "active").length, mrr: "₹599.75" },
];

export function AdminSubscriptions() {
  const [filter, setFilter] = useState<SubStatus | "">("");
  const visible = filter ? SUBS.filter((s) => s.status === filter) : SUBS;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground mt-1 text-sm">Plans, entitlements, dunning, and MRR-oriented operations.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Active subscribers", value: SUBS.filter((s) => s.status === "active").length, icon: Users, color: "text-success" },
          { label: "MRR", value: "₹1,497", icon: Activity, color: "text-foreground" },
          { label: "Past due", value: SUBS.filter((s) => s.status === "past_due").length, icon: ArrowUpRight, color: "text-destructive" },
          { label: "Churn this month", value: SUBS.filter((s) => s.status === "cancelled").length, icon: TrendingDown, color: "text-warning" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <div className="text-muted-foreground flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              <Icon className={cn("size-4 opacity-70", color)} />
            </div>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div key={plan.name} className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-foreground font-semibold">{plan.name}</p>
                <p className="text-muted-foreground text-sm"><span className="text-foreground text-lg font-bold">{plan.price}</span>{plan.period}</p>
              </div>
              <span className="bg-success/15 text-success rounded-full px-2 py-0.5 text-xs font-medium">Active</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-muted-foreground text-xs uppercase">Subscribers</p>
                <p className="text-foreground mt-0.5 text-xl font-bold">{plan.subs}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase">Monthly revenue</p>
                <p className="text-success mt-0.5 text-xl font-bold">{plan.mrr}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        {(["", "active", "trialing", "past_due", "cancelled"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s as SubStatus | "")}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === s ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s ? s.replace("_", " ") : "All"}
          </button>
        ))}
      </div>

      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Subscriber", "Plan", "Amount", "Status", "Started", "Renewal / Cancelled"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((sub) => (
                <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-foreground font-medium">{sub.user}</p>
                    <p className="text-muted-foreground text-xs">{sub.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-foreground">{sub.plan}</p>
                    <p className="text-muted-foreground text-xs capitalize">{sub.interval}</p>
                  </td>
                  <td className="text-foreground px-5 py-3 font-semibold tabular-nums">{sub.amount}</td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[sub.status])}>
                      {sub.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-5 py-3 text-xs">{sub.startDate}</td>
                  <td className="text-muted-foreground px-5 py-3 text-xs">
                    {sub.cancelledAt ? `Cancelled ${sub.cancelledAt}` : sub.renewalDate ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
