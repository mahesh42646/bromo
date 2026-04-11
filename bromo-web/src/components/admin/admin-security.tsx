"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Globe, Lock, Monitor, Shield, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Session {
  id: string;
  admin: string;
  email: string;
  device: string;
  ip: string;
  location: string;
  startedAt: string;
  expiresAt: string;
  current: boolean;
}

const SESSIONS: Session[] = [
  { id: "1", admin: "Super Admin", email: "admin@gmail.com", device: "Chrome 124 / macOS", ip: "192.168.1.1", location: "Mumbai, IN", startedAt: "2026-04-07 08:30", expiresAt: "2026-04-07 16:30", current: true },
  { id: "2", admin: "Content Manager", email: "content@bromo.app", device: "Safari / iPhone 15", ip: "10.0.0.5", location: "Delhi, IN", startedAt: "2026-04-07 09:00", expiresAt: "2026-04-07 17:00", current: false },
  { id: "3", admin: "Content Manager", email: "content@bromo.app", device: "Firefox 125 / Windows", ip: "203.45.12.89", location: "Bangalore, IN", startedAt: "2026-04-06 14:00", expiresAt: "2026-04-06 22:00", current: false },
];

const IP_ALLOWLIST = ["192.168.1.0/24", "10.0.0.0/8", "203.45.12.0/24"];

export function AdminSecurity() {
  const [sessions, setSessions] = useState(SESSIONS);
  const [allowlist, setAllowlist] = useState(IP_ALLOWLIST);
  const [newIp, setNewIp] = useState("");
  const [sessionTimeout, setSessionTimeout] = useState("8");
  const [mfa, setMfa] = useState(false);
  const [forceHttps, setForceHttps] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function revokeSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  function addIp() {
    if (!newIp.trim()) return;
    setAllowlist((prev) => [...prev, newIp.trim()]);
    setNewIp("");
  }

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Security & sessions</h1>
        <p className="text-muted-foreground mt-1 text-sm">MFA policies, session revocation, IP allowlists, and anomaly signals.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active sessions", value: sessions.length, color: "text-foreground", icon: Monitor },
          { label: "IP allowlist rules", value: allowlist.length, color: "text-accent", icon: Globe },
          { label: "Failed logins (24h)", value: 3, color: "text-warning", icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <div className="text-muted-foreground flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              <Icon className="size-4 opacity-60" />
            </div>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Policy settings */}
        <div className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Shield className="text-accent size-4" />
            <h2 className="text-foreground font-semibold">Security policies</h2>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-foreground font-medium">Multi-factor authentication</p>
                <p className="text-muted-foreground text-xs">Require MFA for all admin logins</p>
              </div>
              <button
                onClick={() => setMfa(!mfa)}
                className={cn("relative h-6 w-11 rounded-full transition-colors", mfa ? "bg-success" : "bg-muted")}
              >
                <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform", mfa && "translate-x-5")} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-foreground font-medium">Force HTTPS</p>
                <p className="text-muted-foreground text-xs">Redirect all HTTP requests to HTTPS</p>
              </div>
              <button
                onClick={() => setForceHttps(!forceHttps)}
                className={cn("relative h-6 w-11 rounded-full transition-colors", forceHttps ? "bg-success" : "bg-muted")}
              >
                <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform", forceHttps && "translate-x-5")} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-foreground font-medium">Login alerts</p>
                <p className="text-muted-foreground text-xs">Email on new admin login from unknown IP</p>
              </div>
              <button
                onClick={() => setLoginAlerts(!loginAlerts)}
                className={cn("relative h-6 w-11 rounded-full transition-colors", loginAlerts ? "bg-success" : "bg-muted")}
              >
                <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform", loginAlerts && "translate-x-5")} />
              </button>
            </div>

            <div>
              <label className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                <Clock className="size-3" /> Session timeout (hours)
              </label>
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {["1", "2", "4", "8", "12", "24"].map((h) => (
                  <option key={h} value={h}>{h} hour{h !== "1" ? "s" : ""}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => void save()} disabled={saving} className="bg-accent text-accent-foreground rounded-xl px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {saving ? "Saving…" : "Save policies"}
              </button>
              {saved && <span className="text-success text-sm">Saved!</span>}
            </div>
          </div>
        </div>

        {/* IP allowlist */}
        <div className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Globe className="text-accent size-4" />
            <h2 className="text-foreground font-semibold">IP allowlist</h2>
          </div>
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addIp()}
              placeholder="192.168.1.0/24 or exact IP"
              className="border-input bg-background text-foreground placeholder:text-placeholder flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button onClick={addIp} className="bg-accent text-accent-foreground rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90">
              Add
            </button>
          </div>
          <div className="space-y-2">
            {allowlist.map((ip) => (
              <div key={ip} className="border-border flex items-center justify-between rounded-xl border px-3 py-2">
                <code className="text-foreground text-sm">{ip}</code>
                <button onClick={() => setAllowlist((prev) => prev.filter((x) => x !== ip))} className="text-muted-foreground hover:text-destructive rounded p-1">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          {allowlist.length === 0 && (
            <p className="text-muted-foreground mt-3 text-center text-sm">No restrictions — all IPs allowed</p>
          )}
        </div>
      </div>

      {/* Active sessions */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Lock className="text-accent size-4" />
            <h2 className="text-foreground font-semibold">Active admin sessions</h2>
          </div>
        </div>
        <div className="divide-border divide-y">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Monitor className="text-muted-foreground size-4 shrink-0" />
                  <span className="text-foreground font-medium">{s.admin}</span>
                  {s.current && <span className="bg-success/15 text-success rounded-full px-2 py-0.5 text-[11px] font-medium">Current</span>}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">{s.device} · {s.ip} · {s.location}</p>
                <p className="text-muted-foreground text-xs">Started {s.startedAt} · Expires {s.expiresAt}</p>
              </div>
              {!s.current && (
                <button
                  onClick={() => revokeSession(s.id)}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="border-border border-t px-5 py-4">
          <button className="text-destructive text-sm font-medium hover:underline">
            Revoke all other sessions
          </button>
        </div>
      </div>
    </div>
  );
}
