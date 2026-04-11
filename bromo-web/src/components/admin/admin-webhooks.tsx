"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Link2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  successRate: number;
  lastDelivery: string | null;
  totalDeliveries: number;
}

const ALL_EVENTS = [
  "user.created", "user.updated", "user.deleted",
  "content.published", "content.deleted",
  "payment.succeeded", "payment.failed",
  "subscription.created", "subscription.cancelled",
  "report.generated",
];

const INITIAL_WEBHOOKS: Webhook[] = [
  { id: "1", url: "https://api.yourapp.com/webhooks/bromo", events: ["user.created", "user.updated", "payment.succeeded"], secret: "whsec_••••••••", active: true, successRate: 98.4, lastDelivery: "2026-04-07 10:12", totalDeliveries: 14820 },
  { id: "2", url: "https://zapier.com/hooks/catch/12345/abcde", events: ["content.published", "user.created"], secret: "whsec_••••••••", active: true, successRate: 100, lastDelivery: "2026-04-07 09:44", totalDeliveries: 3210 },
  { id: "3", url: "https://make.com/hook/bromo/analytics", events: ["payment.succeeded", "payment.failed", "subscription.created"], secret: "whsec_••••••••", active: false, successRate: 84.2, lastDelivery: "2026-04-05 16:30", totalDeliveries: 8940 },
];

const DELIVERY_LOGS = [
  { id: "1", webhookId: "1", event: "user.created", status: 200, duration: "142ms", ts: "2026-04-07 10:12:03" },
  { id: "2", webhookId: "1", event: "payment.succeeded", status: 200, duration: "98ms", ts: "2026-04-07 10:08:45" },
  { id: "3", webhookId: "2", event: "content.published", status: 200, duration: "210ms", ts: "2026-04-07 09:44:12" },
  { id: "4", webhookId: "3", event: "payment.failed", status: 500, duration: "3012ms", ts: "2026-04-05 16:30:01" },
  { id: "5", webhookId: "1", event: "user.updated", status: 200, duration: "119ms", ts: "2026-04-05 14:22:55" },
];

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (w: Webhook) => void }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  function toggleEvent(e: string) {
    setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }

  function create() {
    if (!url || !events.length) return;
    onCreate({
      id: String(Date.now()),
      url,
      events,
      secret: "whsec_" + Math.random().toString(36).slice(2, 10),
      active: true,
      successRate: 100,
      lastDelivery: null,
      totalDeliveries: 0,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-overlay fixed inset-0" onClick={onClose} />
      <div className="border-border bg-background brand-surface relative w-full max-w-lg rounded-2xl border p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Add webhook endpoint</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1"><X className="size-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Endpoint URL</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks" className="border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Events to listen to</label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((e) => (
                <button
                  key={e}
                  onClick={() => toggleEvent(e)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                    events.includes(e) ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >{e}</button>
              ))}
            </div>
          </div>
          <button onClick={create} disabled={!url || !events.length} className="bg-accent text-accent-foreground w-full rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            Create endpoint
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminWebhooks() {
  const [webhooks, setWebhooks] = useState(INITIAL_WEBHOOKS);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const logs = selectedId ? DELIVERY_LOGS.filter((l) => l.webhookId === selectedId) : DELIVERY_LOGS;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground mt-1 text-sm">Outbound event subscriptions, delivery logs, and retry policies.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="size-4" />
          Add endpoint
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active endpoints", value: webhooks.filter((w) => w.active).length },
          { label: "Total deliveries", value: webhooks.reduce((s, w) => s + w.totalDeliveries, 0).toLocaleString() },
          { label: "Avg. success rate", value: webhooks.length ? `${(webhooks.reduce((s, w) => s + w.successRate, 0) / webhooks.length).toFixed(1)}%` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Endpoints */}
      <div className="space-y-3">
        {webhooks.map((w) => (
          <div key={w.id} className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link2 className="text-muted-foreground size-4 shrink-0" />
                  <code className="text-foreground min-w-0 truncate text-sm font-medium">{w.url}</code>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", w.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                    {w.active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {w.events.map((e) => <span key={e} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-mono">{e}</span>)}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setSelectedId(selectedId === w.id ? null : w.id)} title="View logs" className="text-muted-foreground hover:text-foreground rounded-lg p-1.5">
                  <RefreshCw className="size-4" />
                </button>
                <button onClick={() => setWebhooks((prev) => prev.filter((x) => x.id !== w.id))} className="text-muted-foreground hover:text-destructive rounded-lg p-1.5">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
              <span>Success rate: <span className={cn("font-semibold", w.successRate >= 95 ? "text-success" : "text-warning")}>{w.successRate}%</span></span>
              <span>Last delivery: {w.lastDelivery ?? "never"}</span>
              <span>{w.totalDeliveries.toLocaleString()} total</span>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery logs */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-foreground font-semibold">Delivery logs</h2>
          {selectedId && <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground text-xs">Clear filter</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Status", "Event", "Duration", "Time"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    {log.status < 300 ? (
                      <span className="text-success flex items-center gap-1.5 text-xs font-medium"><CheckCircle2 className="size-3.5" />{log.status}</span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1.5 text-xs font-medium"><AlertCircle className="size-3.5" />{log.status}</span>
                    )}
                  </td>
                  <td className="px-5 py-3"><code className="text-foreground text-xs">{log.event}</code></td>
                  <td className="text-muted-foreground px-5 py-3 text-xs tabular-nums">{log.duration}</td>
                  <td className="text-muted-foreground px-5 py-3 text-xs">{log.ts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={(w) => setWebhooks((prev) => [w, ...prev])} />}
    </div>
  );
}
