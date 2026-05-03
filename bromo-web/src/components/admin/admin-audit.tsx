"use client";

import { useState } from "react";
import { Filter, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type EventType = "login" | "user_edit" | "user_delete" | "security_change" | "role_change" | "system";

interface AuditEvent {
  id: string;
  type: EventType;
  admin: string;
  adminEmail: string;
  action: string;
  target: string;
  ip: string;
  ts: string;
  severity: "info" | "warn" | "critical";
}

const EVENTS: AuditEvent[] = [
  { id: "1", type: "login", admin: "Super Admin", adminEmail: "admin@gmail.com", action: "Admin login", target: "auth", ip: "192.168.1.1", ts: new Date(Date.now() - 300000).toISOString(), severity: "info" },
  { id: "2", type: "security_change", admin: "Super Admin", adminEmail: "admin@gmail.com", action: "Updated session policy", target: "system.security", ip: "192.168.1.1", ts: new Date(Date.now() - 600000).toISOString(), severity: "warn" },
  { id: "3", type: "user_edit", admin: "Super Admin", adminEmail: "admin@gmail.com", action: "Deactivated user account", target: "user@example.com", ip: "192.168.1.1", ts: new Date(Date.now() - 3600000).toISOString(), severity: "warn" },
  { id: "4", type: "role_change", admin: "Super Admin", adminEmail: "admin@gmail.com", action: "Changed admin role", target: "content@bromo.app → super_admin", ip: "192.168.1.1", ts: new Date(Date.now() - 7200000).toISOString(), severity: "critical" },
  { id: "5", type: "user_delete", admin: "Super Admin", adminEmail: "admin@gmail.com", action: "Deleted user account", target: "spam@user.com", ip: "192.168.1.1", ts: new Date(Date.now() - 86400000).toISOString(), severity: "critical" },
  { id: "6", type: "system", admin: "System", adminEmail: "system", action: "Maintenance mode enabled", target: "platform", ip: "internal", ts: new Date(Date.now() - 172800000).toISOString(), severity: "warn" },
  { id: "7", type: "login", admin: "Content Manager", adminEmail: "content@bromo.app", action: "Admin login", target: "auth", ip: "10.0.0.5", ts: new Date(Date.now() - 259200000).toISOString(), severity: "info" },
];

const SEVERITY_STYLES: Record<AuditEvent["severity"], string> = {
  info: "bg-success/10 text-success",
  warn: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

const TYPE_LABEL: Record<EventType, string> = {
  login: "Login",
  user_edit: "User edit",
  user_delete: "User delete",
  security_change: "Security",
  role_change: "Role change",
  system: "System",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AdminAuditLog() {
  const [filterType, setFilterType] = useState<EventType | "">("");
  const [filterSeverity, setFilterSeverity] = useState<AuditEvent["severity"] | "">("");

  const filtered = EVENTS.filter((e) => {
    if (filterType && e.type !== filterType) return false;
    if (filterSeverity && e.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground mt-1 text-sm">Immutable admin action history for compliance and investigations.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Events today", value: EVENTS.filter((e) => Date.now() - new Date(e.ts).getTime() < 86400000).length, color: "text-foreground" },
          { label: "Warnings", value: EVENTS.filter((e) => e.severity === "warn").length, color: "text-warning" },
          { label: "Critical", value: EVENTS.filter((e) => e.severity === "critical").length, color: "text-destructive" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="border-border bg-background brand-surface flex flex-wrap items-center gap-3 rounded-2xl border p-4 shadow-sm">
        <Filter className="text-muted-foreground size-4" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as EventType | "")}
          className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All event types</option>
          {(Object.keys(TYPE_LABEL) as EventType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as AuditEvent["severity"] | "")}
          className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <span className="text-muted-foreground ml-auto text-xs">{filtered.length} events</span>
      </div>

      {/* Timeline */}
      <div className="relative space-y-0">
        <div className="border-border absolute left-[23px] top-0 h-full w-px border-l border-dashed" />
        {filtered.map((event) => (
          <div key={event.id} className="relative flex gap-5 pb-6">
            <div className={cn(
              "relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-background",
              event.severity === "critical" ? "bg-destructive/20 text-destructive" :
              event.severity === "warn" ? "bg-warning/20 text-warning" :
              "bg-success/15 text-success",
            )}>
              {event.type === "login" || event.type === "role_change" ? <User className="size-5" /> : <Shield className="size-5" />}
            </div>
            <div className="border-border bg-background brand-surface flex-1 rounded-2xl border p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-foreground font-medium">{event.action}</p>
                  <p className="text-muted-foreground text-xs">
                    {event.admin} · {event.target}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", SEVERITY_STYLES[event.severity])}>
                    {event.severity}
                  </span>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                    {TYPE_LABEL[event.type]}
                  </span>
                </div>
              </div>
              <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                <span>IP: {event.ip}</span>
                <span>{new Date(event.ts).toLocaleString()}</span>
                <span className="ml-auto">{timeAgo(event.ts)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
