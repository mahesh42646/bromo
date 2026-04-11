"use client";

import { useState } from "react";
import { Download, FileBarChart, FileClock, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const REPORT_TYPES = [
  { id: "user-growth", label: "User growth", desc: "New registrations, churn, and net growth by cohort.", icon: Users, formats: ["CSV", "XLSX"] },
  { id: "engagement", label: "Engagement report", desc: "DAU, MAU, session length, and feature adoption.", icon: FileBarChart, formats: ["CSV", "PDF"] },
  { id: "content-performance", label: "Content performance", desc: "Top posts, reels, stories by reach and engagement.", icon: FileText, formats: ["CSV", "XLSX", "PDF"] },
  { id: "revenue", label: "Revenue report", desc: "MRR, ARR, payment volume, and churn revenue.", icon: FileClock, formats: ["CSV", "PDF"] },
];

const SCHEDULED = [
  { name: "Weekly user summary", freq: "Every Monday 09:00", last: "2026-04-07", recipients: 2, status: "active" },
  { name: "Monthly revenue digest", freq: "1st of month 08:00", last: "2026-04-01", recipients: 3, status: "active" },
  { name: "Quarterly growth report", freq: "Every 3 months", last: "2026-01-01", recipients: 5, status: "paused" },
];

export function AdminReports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-04-07");
  const [format, setFormat] = useState("CSV");
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1500));
    setGenerating(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">Scheduled reports and on-demand data exports.</p>
      </div>

      {/* Report builder */}
      <div className="border-border bg-background brand-surface rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground mb-4 font-semibold">Generate report</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {REPORT_TYPES.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                onClick={() => { setSelectedReport(r.id); setFormat(r.formats[0]); }}
                className={cn(
                  "border-border rounded-xl border p-4 text-left transition-all",
                  selectedReport === r.id ? "ring-2 ring-ring bg-muted/40" : "hover:bg-muted/30",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-accent/10 text-accent flex size-8 items-center justify-center rounded-xl">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-foreground font-medium">{r.label}</p>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">{r.desc}</p>
                <div className="mt-2 flex gap-1.5">
                  {r.formats.map((f) => (
                    <span key={f} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">{f}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {selectedReport && (
          <div className="border-border mt-5 border-t pt-5">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border-input bg-background text-foreground rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border-input bg-background text-foreground rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="border-input bg-background text-foreground rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {REPORT_TYPES.find((r) => r.id === selectedReport)?.formats.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => void generate()}
                disabled={generating}
                className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Download className="size-4" />
                {generating ? "Generating…" : `Export ${format}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scheduled reports */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground font-semibold">Scheduled reports</h2>
        </div>
        <div className="divide-border divide-y">
          {SCHEDULED.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-foreground font-medium">{s.name}</p>
                <p className="text-muted-foreground text-xs">{s.freq} · {s.recipients} recipients · Last sent {s.last}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  s.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}>
                  {s.status}
                </span>
                <button className="text-muted-foreground hover:text-foreground border-border rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
