"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock, LifeBuoy, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Priority = "critical" | "high" | "medium" | "low";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

interface Ticket {
  id: string;
  title: string;
  user: string;
  email: string;
  priority: Priority;
  status: TicketStatus;
  category: string;
  messages: number;
  createdAt: string;
  updatedAt: string;
}

const TICKETS: Ticket[] = [
  { id: "T-001", title: "Cannot upload video – stuck at 99%", user: "Alex Johnson", email: "alex@example.com", priority: "high", status: "open", category: "Bug", messages: 3, createdAt: "2026-04-07 08:12", updatedAt: "2026-04-07 09:44" },
  { id: "T-002", title: "Account suspended incorrectly", user: "Maria Garcia", email: "maria@example.com", priority: "critical", status: "in_progress", category: "Account", messages: 7, createdAt: "2026-04-06 14:30", updatedAt: "2026-04-07 10:01" },
  { id: "T-003", title: "Payment declined but still charged", user: "James Wilson", email: "james@example.com", priority: "critical", status: "open", category: "Billing", messages: 2, createdAt: "2026-04-06 11:20", updatedAt: "2026-04-06 12:00" },
  { id: "T-004", title: "Profile picture not updating", user: "Sofia Chen", email: "sofia@example.com", priority: "medium", status: "in_progress", category: "Bug", messages: 4, createdAt: "2026-04-05 16:00", updatedAt: "2026-04-06 08:30" },
  { id: "T-005", title: "How to delete my account?", user: "Tom Brown", email: "tom@example.com", priority: "low", status: "resolved", category: "Account", messages: 1, createdAt: "2026-04-04 09:00", updatedAt: "2026-04-04 14:00" },
  { id: "T-006", title: "App crashes on iPhone 15 Pro", user: "Emma Davis", email: "emma@example.com", priority: "high", status: "open", category: "Bug", messages: 5, createdAt: "2026-04-03 20:15", updatedAt: "2026-04-04 11:20" },
];

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-warning/15 text-warning",
  medium: "bg-accent/15 text-accent",
  low: "bg-muted text-muted-foreground",
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-warning/15 text-warning",
  in_progress: "bg-accent/15 text-accent",
  resolved: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<TicketStatus, React.ComponentType<{ className?: string }>> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle2,
  closed: CheckCircle2,
};

export function AdminSupport() {
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "">("");
  const [filterPriority, setFilterPriority] = useState<Priority | "">("");
  const [selected, setSelected] = useState<Ticket | null>(null);

  const tickets = TICKETS.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const stats = [
    { label: "Open tickets", value: TICKETS.filter((t) => t.status === "open").length, color: "text-warning" },
    { label: "In progress", value: TICKETS.filter((t) => t.status === "in_progress").length, color: "text-accent" },
    { label: "Critical", value: TICKETS.filter((t) => t.priority === "critical").length, color: "text-destructive" },
    { label: "Resolved today", value: TICKETS.filter((t) => t.status === "resolved").length, color: "text-success" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Support tickets</h1>
        <p className="text-muted-foreground mt-1 text-sm">Customer issues, SLA tracking, and escalation management.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Ticket list */}
        <div className="col-span-3 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TicketStatus | "")}
              className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All status</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as Priority | "")}
              className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="text-muted-foreground ml-auto self-center text-xs">{tickets.length} tickets</span>
          </div>

          <div className="space-y-2">
            {tickets.map((ticket) => {
              const StatusIcon = STATUS_ICONS[ticket.status];
              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={cn(
                    "border-border bg-background brand-surface w-full rounded-2xl border p-4 text-left shadow-sm transition-all hover:bg-muted/30",
                    selected?.id === ticket.id && "ring-2 ring-ring",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs">{ticket.id}</span>
                        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">{ticket.category}</span>
                      </div>
                      <p className="text-foreground mt-1 font-medium">{ticket.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{ticket.user} · {ticket.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", PRIORITY_STYLES[ticket.priority])}>
                        {ticket.priority}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[ticket.status])}>
                        <StatusIcon className="size-3" />
                        {ticket.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3" /> {ticket.messages}
                    </span>
                    <span>Updated {ticket.updatedAt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="border-border bg-background brand-surface col-span-2 rounded-2xl border p-5 shadow-sm">
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-xs">{selected.id}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PRIORITY_STYLES[selected.priority])}>
                    {selected.priority}
                  </span>
                </div>
                <h3 className="text-foreground mt-2 font-semibold">{selected.title}</h3>
                <p className="text-muted-foreground text-xs">{selected.user} — {selected.email}</p>
              </div>

              <div className="border-border rounded-xl border p-3">
                <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Change status</label>
                <select className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                  {(["open", "in_progress", "resolved", "closed"] as TicketStatus[]).map((s) => (
                    <option key={s} value={s} selected={s === selected.status}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              <div className="border-border rounded-xl border p-3">
                <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Reply</label>
                <textarea
                  rows={4}
                  placeholder="Type your response…"
                  className="border-input bg-background text-foreground placeholder:text-placeholder w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button className="bg-accent text-accent-foreground mt-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90">
                  Send reply
                </button>
              </div>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="text-foreground">{selected.createdAt}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd className="text-foreground">{selected.updatedAt}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Messages</dt>
                  <dd className="text-foreground">{selected.messages}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <LifeBuoy className="text-muted-foreground size-8 opacity-40" />
              <p className="text-muted-foreground text-sm">Select a ticket to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
