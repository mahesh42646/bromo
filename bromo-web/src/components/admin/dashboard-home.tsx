"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Megaphone,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { ADMIN_NAVIGATION } from "@/config/admin-navigation";
import { cn } from "@/lib/utils/cn";

interface DashboardStats {
  totalUsers: number | null;
  totalAds: number | null;
}

function useDashboardStats(): DashboardStats & { loading: boolean } {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: null, totalAds: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/users?limit=1").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/admin/ads").then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([usersData, adsData]) => {
      if (cancelled) return;
      setStats({
        totalUsers: (usersData as { total?: number } | null)?.total ?? null,
        totalAds: Array.isArray((adsData as { ads?: unknown[] } | null)?.ads)
          ? ((adsData as { ads: unknown[] }).ads.length)
          : null,
      });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { ...stats, loading };
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.18)] hover:-translate-y-0.5">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <div className={cn("flex size-8 items-center justify-center rounded-xl", accent)}>
            <Icon className="size-3.5" aria-hidden />
          </div>
        </div>
        <p
          className={cn(
            "mt-3 text-3xl font-semibold tabular-nums tracking-tight text-foreground",
            loading && "text-muted-foreground/40",
          )}
        >
          {loading ? "—" : value}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3.5 rounded-2xl border border-border bg-surface p-4 transition-all duration-150 hover:border-accent/30 hover:bg-accent/[0.04] hover:shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 transition-colors group-hover:bg-accent/15">
        <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-accent" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </Link>
  );
}

export function DashboardHome({
  platformName,
  appTitle,
}: {
  platformName: string;
  appTitle: string;
}) {
  const { totalUsers, totalAds, loading } = useDashboardStats();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const allLinks = ADMIN_NAVIGATION.flatMap((g) =>
    g.items.filter((i) => i.href !== "/admin/dashboard"),
  );

  const statCards = [
    {
      label: "Platform users",
      value: totalUsers !== null ? totalUsers.toLocaleString() : "—",
      hint: "Registered accounts in MongoDB",
      icon: Users,
      accent: "bg-accent/15 text-accent",
    },
    {
      label: "Total ads",
      value: totalAds !== null ? String(totalAds) : "—",
      hint: "Ads created in ads manager",
      icon: Megaphone,
      accent: "bg-success/15 text-success",
    },
    {
      label: "Audit events (24h)",
      value: "—",
      hint: "Live when audit API is wired",
      icon: Shield,
      accent: "bg-warning/15 text-warning",
    },
    {
      label: "Active sessions",
      value: "—",
      hint: "Live when sessions API is wired",
      icon: Activity,
      accent: "bg-muted/80 text-muted-foreground",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Hero header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {today}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground text-balance">
            {platformName} Admin Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Managing <span className="font-medium text-foreground">{appTitle}</span> — overview and quick entry to every admin area.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2">
          <TrendingUp className="size-4 text-success" aria-hidden />
          <span className="text-xs font-medium text-muted-foreground">System operational</span>
        </div>
      </div>

      {/* KPI stats */}
      <section aria-label="Overview metrics">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Analytics snapshot</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} loading={loading} />
          ))}
        </div>
      </section>

      {/* Quick links grid — all admin areas */}
      <section aria-label="Admin areas">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <h2 className="shrink-0 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            All admin areas
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allLinks.map((item) => (
            <QuickLinkCard
              key={item.href}
              href={item.href}
              title={item.title}
              description={item.description}
              icon={item.icon}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
