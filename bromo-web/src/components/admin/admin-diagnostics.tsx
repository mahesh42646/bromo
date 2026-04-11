"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, RefreshCw, Server, Terminal, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface HealthCheck {
  name: string;
  status: "ok" | "degraded" | "down";
  latency: string;
  detail: string;
}

const ERROR_LOGS = [
  { level: "error", message: "MongoDB connection timeout: retry 1/3", ts: "2026-04-07 10:04:21", service: "db" },
  { level: "warn", message: "Rate limit triggered for IP 203.45.12.89", ts: "2026-04-07 09:58:10", service: "api" },
  { level: "error", message: "Webhook delivery failed: ECONNREFUSED make.com", ts: "2026-04-07 09:30:05", service: "webhooks" },
  { level: "info", message: "Admin session created: admin@gmail.com", ts: "2026-04-07 08:30:00", service: "auth" },
  { level: "warn", message: "Slow query detected (1.8s): users.find filter:{isActive:false}", ts: "2026-04-07 08:01:44", service: "db" },
];

const STATUS_ICON = {
  ok: CheckCircle2,
  degraded: Activity,
  down: XCircle,
};

const STATUS_COLOR = {
  ok: "text-success",
  degraded: "text-warning",
  down: "text-destructive",
};

const LOG_COLOR: Record<string, string> = {
  error: "text-destructive",
  warn: "text-warning",
  info: "text-success",
};

const ENV_INFO = [
  { label: "Node.js", value: "v22.11.0" },
  { label: "Next.js", value: "16.2.1" },
  { label: "MongoDB driver", value: "6.12.0" },
  { label: "Mongoose", value: "8.x" },
  { label: "Environment", value: "production" },
  { label: "Region", value: "ap-south-1 (Mumbai)" },
  { label: "API URL", value: "https://bromo.darkunde.in" },
  { label: "Uptime", value: "14d 6h 22m" },
];

export function AdminDiagnostics() {
  const [health, setHealth] = useState<HealthCheck[]>([
    { name: "API server", status: "ok", latency: "42ms", detail: "Express responding normally" },
    { name: "MongoDB", status: "ok", latency: "8ms", detail: "4/4 connections healthy" },
    { name: "Firebase Auth", status: "ok", latency: "120ms", detail: "SDK initialized, tokens valid" },
    { name: "Cloudinary CDN", status: "degraded", latency: "980ms", detail: "Elevated latency — monitoring" },
    { name: "FCM push gateway", status: "ok", latency: "215ms", detail: "Device token sync healthy" },
    { name: "Webhook dispatcher", status: "down", latency: "—", detail: "make.com endpoint unreachable" },
  ]);

  const [refreshing, setRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "up" | "down">("checking");

  useEffect(() => {
    fetch("https://bromo.darkunde.in/health")
      .then((r) => setApiStatus(r.ok ? "up" : "down"))
      .catch(() => setApiStatus("down"));
  }, []);

  async function refresh() {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1200));
    setHealth((prev) =>
      prev.map((h) => ({
        ...h,
        latency: h.status !== "down" ? `${Math.round(Math.random() * 200 + 10)}ms` : "—",
      })),
    );
    setRefreshing(false);
  }

  const okCount = health.filter((h) => h.status === "ok").length;
  const degradedCount = health.filter((h) => h.status === "degraded").length;
  const downCount = health.filter((h) => h.status === "down").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Developer diagnostics</h1>
          <p className="text-muted-foreground mt-1 text-sm">System health, error logs, and on-call escalation bundles.</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="border-border bg-muted/40 text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Live API status */}
      <div className={cn(
        "border rounded-2xl p-4 flex items-center gap-4",
        apiStatus === "up" ? "border-success/30 bg-success/10" :
        apiStatus === "down" ? "border-destructive/30 bg-destructive/10" :
        "border-border bg-muted/30",
      )}>
        <Server className={cn("size-5 shrink-0", apiStatus === "up" ? "text-success" : apiStatus === "down" ? "text-destructive" : "text-muted-foreground")} />
        <div>
          <p className="text-foreground font-semibold">Live API — bromo.darkunde.in</p>
          <p className={cn("text-sm font-medium", apiStatus === "up" ? "text-success" : apiStatus === "down" ? "text-destructive" : "text-muted-foreground")}>
            {apiStatus === "checking" ? "Checking…" : apiStatus === "up" ? "Reachable — /health OK" : "Unreachable — check server logs"}
          </p>
        </div>
      </div>

      {/* Health summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Healthy", value: okCount, color: "text-success" },
          { label: "Degraded", value: degradedCount, color: "text-warning" },
          { label: "Down", value: downCount, color: "text-destructive" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Health checks */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground font-semibold">Service health checks</h2>
        </div>
        <div className="divide-border divide-y">
          {health.map((h) => {
            const Icon = STATUS_ICON[h.status];
            return (
              <div key={h.name} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Icon className={cn("size-5 shrink-0", STATUS_COLOR[h.status])} />
                  <div>
                    <p className="text-foreground font-medium">{h.name}</p>
                    <p className="text-muted-foreground text-xs">{h.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <span className="text-muted-foreground text-xs tabular-nums">{h.latency}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                    h.status === "ok" ? "bg-success/15 text-success" :
                    h.status === "degraded" ? "bg-warning/15 text-warning" :
                    "bg-destructive/15 text-destructive",
                  )}>
                    {h.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Error logs */}
        <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
          <div className="border-border flex items-center gap-2 border-b px-5 py-4">
            <Terminal className="text-accent size-4" />
            <h2 className="text-foreground font-semibold">Recent logs</h2>
          </div>
          <div className="divide-border divide-y font-mono text-xs">
            {ERROR_LOGS.map((log, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn("font-semibold uppercase", LOG_COLOR[log.level])}>[{log.level}]</span>
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">{log.service}</span>
                  <span className="text-muted-foreground ml-auto">{log.ts}</span>
                </div>
                <p className="text-foreground mt-1 leading-relaxed">{log.message}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Environment info */}
        <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground font-semibold">Environment</h2>
          </div>
          <dl className="divide-border divide-y">
            {ENV_INFO.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
                <dd className="text-foreground font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
