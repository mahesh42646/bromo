"use client";

import { useState } from "react";
import { Archive, CheckCircle2, Clock, Download, FileText, Shield, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type DsarStatus = "pending" | "processing" | "completed" | "rejected";
type DsarType = "export" | "deletion" | "correction" | "restriction";

interface DsarRequest {
  id: string;
  type: DsarType;
  user: string;
  email: string;
  status: DsarStatus;
  submittedAt: string;
  deadline: string;
  notes: string;
}

const REQUESTS: DsarRequest[] = [
  { id: "DSAR-001", type: "export", user: "Alex Johnson", email: "alex@example.com", status: "pending", submittedAt: "2026-04-05", deadline: "2026-05-05", notes: "User requested full data export under GDPR Art. 20" },
  { id: "DSAR-002", type: "deletion", user: "Maria Garcia", email: "maria@example.com", status: "processing", submittedAt: "2026-04-01", deadline: "2026-05-01", notes: "Right to erasure request — account, posts, and analytics" },
  { id: "DSAR-003", type: "correction", user: "James Wilson", email: "james@example.com", status: "completed", submittedAt: "2026-03-10", deadline: "2026-04-10", notes: "Email correction from typo — completed early" },
  { id: "DSAR-004", type: "export", user: "Sofia Chen", email: "sofia@example.com", status: "rejected", submittedAt: "2026-03-01", deadline: "2026-04-01", notes: "Identity verification failed — re-submitted needed" },
];

const STATUS_CONFIG: Record<DsarStatus, { label: string; style: string }> = {
  pending: { label: "Pending", style: "bg-warning/15 text-warning" },
  processing: { label: "Processing", style: "bg-accent/15 text-accent" },
  completed: { label: "Completed", style: "bg-success/15 text-success" },
  rejected: { label: "Rejected", style: "bg-destructive/15 text-destructive" },
};

const TYPE_LABEL: Record<DsarType, string> = {
  export: "Data export",
  deletion: "Erasure",
  correction: "Correction",
  restriction: "Restriction",
};

const RETENTION_POLICIES = [
  { category: "User profiles", retention: "Until account deletion + 30 days", legal: "GDPR Art. 5(1)(e)" },
  { category: "User-generated content", retention: "Until deletion + 90 days", legal: "Platform T&C" },
  { category: "Analytics events", retention: "24 months (anonymized after 12m)", legal: "GDPR Art. 89" },
  { category: "Payment data", retention: "7 years (PCI DSS)", legal: "PCI DSS + tax law" },
  { category: "Audit logs", retention: "5 years", legal: "SOC 2 Type II" },
  { category: "Support tickets", retention: "3 years after resolution", legal: "Business records" },
];

export function AdminCompliance() {
  const [requests, setRequests] = useState(REQUESTS);
  const [activeTab, setActiveTab] = useState<"dsar" | "retention" | "exports">("dsar");

  function updateStatus(id: string, status: DsarStatus) {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  }

  const stats = [
    { label: "Open requests", value: requests.filter((r) => r.status === "pending" || r.status === "processing").length, color: "text-warning" },
    { label: "Completed", value: requests.filter((r) => r.status === "completed").length, color: "text-success" },
    { label: "Overdue", value: 0, color: "text-destructive" },
    { label: "This month", value: requests.length, color: "text-foreground" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Compliance & data</h1>
        <p className="text-muted-foreground mt-1 text-sm">DSAR tooling, retention policies, and regulatory export packages.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-border flex gap-1 rounded-2xl border p-1 bg-muted/30 w-fit">
        {(["dsar", "retention", "exports"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors capitalize",
              activeTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "dsar" ? "DSA Requests" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "dsar" && (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-muted-foreground text-xs">{req.id}</code>
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-medium">{TYPE_LABEL[req.type]}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CONFIG[req.status].style)}>
                      {STATUS_CONFIG[req.status].label}
                    </span>
                  </div>
                  <p className="text-foreground mt-2 font-medium">{req.user}</p>
                  <p className="text-muted-foreground text-xs">{req.email}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{req.notes}</p>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="size-3" /> Submitted {req.submittedAt}</span>
                    <span className="flex items-center gap-1"><Clock className="size-3" /> Deadline {req.deadline}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {req.status === "pending" && (
                    <button
                      onClick={() => updateStatus(req.id, "processing")}
                      className="bg-accent text-accent-foreground rounded-xl px-3 py-1.5 text-xs font-medium hover:opacity-90"
                    >
                      Process
                    </button>
                  )}
                  {req.status === "processing" && (
                    <button
                      onClick={() => updateStatus(req.id, "completed")}
                      className="bg-success/15 text-success rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-success/25"
                    >
                      Mark complete
                    </button>
                  )}
                  {req.type === "export" && (
                    <button className="border-border text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium">
                      <Download className="size-3.5" />
                      Export
                    </button>
                  )}
                  {req.type === "deletion" && req.status === "processing" && (
                    <button className="bg-destructive/10 text-destructive flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-destructive/20">
                      <Trash2 className="size-3.5" />
                      Delete data
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "retention" && (
        <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground font-semibold">Data retention policies</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b">
                  {["Data category", "Retention period", "Legal basis"].map((h) => (
                    <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {RETENTION_POLICIES.map((p) => (
                  <tr key={p.category} className="hover:bg-muted/30 transition-colors">
                    <td className="text-foreground px-5 py-3 font-medium">{p.category}</td>
                    <td className="text-muted-foreground px-5 py-3">{p.retention}</td>
                    <td className="px-5 py-3">
                      <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]">{p.legal}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "exports" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Full platform export", desc: "All users, content, and settings as JSON/CSV", icon: Archive, size: "~2.4 GB" },
            { label: "User data export", desc: "PII-only export with anonymization options", icon: Shield, size: "~180 MB" },
            { label: "Content export", desc: "All posts, reels, and stories metadata", icon: FileText, size: "~850 MB" },
            { label: "Audit log export", desc: "Admin action history — last 12 months", icon: CheckCircle2, size: "~12 MB" },
          ].map(({ label, desc, icon: Icon, size }) => (
            <div key={label} className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-accent/10 text-accent flex size-10 items-center justify-center rounded-xl">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-foreground font-semibold">{label}</p>
                  <p className="text-muted-foreground text-xs">{size}</p>
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-sm">{desc}</p>
              <button className="bg-accent text-accent-foreground mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90">
                <Download className="size-4" />
                Generate export
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
