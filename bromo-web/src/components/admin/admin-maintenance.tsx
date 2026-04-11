"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Play, RefreshCw, Square, Wrench } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type JobStatus = "running" | "queued" | "completed" | "failed" | "paused";

interface Job {
  id: string;
  name: string;
  schedule: string;
  status: JobStatus;
  lastRun: string | null;
  nextRun: string | null;
  duration: string | null;
  category: "cleanup" | "sync" | "report" | "cache" | "backup";
}

const JOBS: Job[] = [
  { id: "1", name: "Inactive user cleanup", schedule: "0 2 * * *", status: "completed", lastRun: "2026-04-07 02:00", nextRun: "2026-04-08 02:00", duration: "4m 12s", category: "cleanup" },
  { id: "2", name: "Media CDN cache purge", schedule: "0 */6 * * *", status: "running", lastRun: "2026-04-07 09:00", nextRun: "2026-04-07 15:00", duration: null, category: "cache" },
  { id: "3", name: "Analytics aggregation", schedule: "30 1 * * *", status: "completed", lastRun: "2026-04-07 01:30", nextRun: "2026-04-08 01:30", duration: "12m 44s", category: "report" },
  { id: "4", name: "Database backup", schedule: "0 0 * * *", status: "completed", lastRun: "2026-04-07 00:00", nextRun: "2026-04-08 00:00", duration: "8m 01s", category: "backup" },
  { id: "5", name: "Firebase → MongoDB user sync", schedule: "*/15 * * * *", status: "queued", lastRun: "2026-04-07 10:00", nextRun: "2026-04-07 10:15", duration: "38s", category: "sync" },
  { id: "6", name: "Expired session pruning", schedule: "0 3 * * *", status: "failed", lastRun: "2026-04-06 03:00", nextRun: "2026-04-07 03:00", duration: "0s", category: "cleanup" },
];

const STATUS_CONFIG: Record<JobStatus, { label: string; style: string; icon: React.ComponentType<{ className?: string }> }> = {
  running: { label: "Running", style: "text-accent bg-accent/15", icon: RefreshCw },
  queued: { label: "Queued", style: "text-warning bg-warning/15", icon: Clock },
  completed: { label: "Completed", style: "text-success bg-success/15", icon: CheckCircle2 },
  failed: { label: "Failed", style: "text-destructive bg-destructive/15", icon: AlertTriangle },
  paused: { label: "Paused", style: "text-muted-foreground bg-muted", icon: Square },
};

const CAT_COLORS: Record<Job["category"], string> = {
  cleanup: "bg-destructive/10 text-destructive",
  sync: "bg-accent/10 text-accent",
  report: "bg-warning/10 text-warning",
  cache: "bg-muted text-muted-foreground",
  backup: "bg-success/10 text-success",
};

export function AdminMaintenance() {
  const [jobs, setJobs] = useState(JOBS);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("System is under scheduled maintenance. Back soon.");

  function runJob(id: string) {
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: "running" as JobStatus } : j));
    setTimeout(() => {
      setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: "completed" as JobStatus, lastRun: new Date().toLocaleString(), duration: "2m 05s" } : j));
    }, 3000);
  }

  const stats = [
    { label: "Running", value: jobs.filter((j) => j.status === "running").length, color: "text-accent" },
    { label: "Queued", value: jobs.filter((j) => j.status === "queued").length, color: "text-warning" },
    { label: "Failed", value: jobs.filter((j) => j.status === "failed").length, color: "text-destructive" },
    { label: "Completed today", value: jobs.filter((j) => j.status === "completed").length, color: "text-success" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Jobs & maintenance</h1>
        <p className="text-muted-foreground mt-1 text-sm">Background workers, job queues, and safe-mode controls.</p>
      </div>

      {/* Maintenance mode banner */}
      <div className={cn(
        "border rounded-2xl p-5 transition-all",
        maintenanceMode ? "border-warning/40 bg-warning/10" : "border-border bg-background brand-surface",
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wrench className={cn("size-5", maintenanceMode ? "text-warning" : "text-muted-foreground")} />
            <div>
              <p className="text-foreground font-semibold">Maintenance mode</p>
              <p className="text-muted-foreground text-xs">Puts the app in read-only mode for end users</p>
            </div>
          </div>
          <button
            onClick={() => setMaintenanceMode(!maintenanceMode)}
            className={cn("relative h-6 w-11 rounded-full transition-colors", maintenanceMode ? "bg-warning" : "bg-muted")}
          >
            <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform", maintenanceMode && "translate-x-5")} />
          </button>
        </div>
        {maintenanceMode && (
          <div className="mt-4">
            <label className="text-warning/80 mb-1.5 block text-xs font-medium uppercase tracking-wide">Maintenance message</label>
            <input
              value={maintenanceMsg}
              onChange={(e) => setMaintenanceMsg(e.target.value)}
              className="border-warning/40 bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-warning"
            />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Job queue */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground font-semibold">Job queue</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Job", "Schedule", "Status", "Last run", "Duration", "Actions"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {jobs.map((job) => {
                const sc = STATUS_CONFIG[job.status];
                const StatusIcon = sc.icon;
                return (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-foreground font-medium">{job.name}</p>
                        <span className={cn("mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", CAT_COLORS[job.category])}>
                          {job.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><code className="text-muted-foreground text-xs">{job.schedule}</code></td>
                    <td className="px-5 py-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", sc.style)}>
                        <StatusIcon className={cn("size-3", job.status === "running" && "animate-spin")} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-5 py-3 text-xs">{job.lastRun ?? "Never"}</td>
                    <td className="text-muted-foreground px-5 py-3 text-xs tabular-nums">{job.duration ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => runJob(job.id)}
                          disabled={job.status === "running"}
                          title="Run now"
                          className="text-muted-foreground hover:text-success disabled:opacity-40 rounded-lg p-1.5"
                        >
                          <Play className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
