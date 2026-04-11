"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, Key, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  masked: string;
  scopes: string[];
  environment: "production" | "sandbox";
  createdAt: string;
  expiresAt: string | null;
  lastUsed: string | null;
  usageCount: number;
}

const KEYS: ApiKey[] = [
  { id: "1", name: "Mobile app production", prefix: "bromo_live_", masked: "bromo_live_••••••••••••••••sk8f", scopes: ["users:read", "content:read", "notifications:write"], environment: "production", createdAt: "2026-01-15", expiresAt: null, lastUsed: "2026-04-07", usageCount: 142840 },
  { id: "2", name: "Analytics service", prefix: "bromo_live_", masked: "bromo_live_••••••••••••••••k9ax", scopes: ["analytics:read", "users:read"], environment: "production", createdAt: "2026-02-01", expiresAt: "2027-02-01", lastUsed: "2026-04-06", usageCount: 48200 },
  { id: "3", name: "Webhook dispatcher", prefix: "bromo_live_", masked: "bromo_live_••••••••••••••••m2pq", scopes: ["webhooks:write"], environment: "production", createdAt: "2026-03-10", expiresAt: null, lastUsed: "2026-04-07", usageCount: 9100 },
  { id: "4", name: "Dev test key", prefix: "bromo_test_", masked: "bromo_test_••••••••••••••••zx1c", scopes: ["*"], environment: "sandbox", createdAt: "2026-04-01", expiresAt: "2026-05-01", lastUsed: null, usageCount: 124 },
];

const ALL_SCOPES = [
  "users:read", "users:write", "users:delete",
  "content:read", "content:write",
  "analytics:read",
  "notifications:write",
  "webhooks:write",
  "*",
];

function CreateKeyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (key: ApiKey) => void }) {
  const [name, setName] = useState("");
  const [env, setEnv] = useState<"production" | "sandbox">("sandbox");
  const [scopes, setScopes] = useState<string[]>(["users:read"]);
  const [created, setCreated] = useState<string | null>(null);

  function toggleScope(s: string) {
    setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function create() {
    const fullKey = `bromo_${env === "production" ? "live" : "test"}_${Math.random().toString(36).slice(2, 20)}`;
    const newKey: ApiKey = {
      id: String(Date.now()),
      name: name || "Unnamed key",
      prefix: fullKey.slice(0, 11),
      masked: `${fullKey.slice(0, 11)}••••••••••••••••${fullKey.slice(-4)}`,
      scopes,
      environment: env,
      createdAt: new Date().toISOString().slice(0, 10),
      expiresAt: null,
      lastUsed: null,
      usageCount: 0,
    };
    setCreated(fullKey);
    onCreate(newKey);
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-overlay fixed inset-0" onClick={onClose} />
        <div className="border-border bg-background brand-surface relative w-full max-w-md rounded-2xl border p-6 shadow-xl">
          <h3 className="text-foreground font-semibold">Key created — save it now</h3>
          <p className="text-muted-foreground mt-1 text-sm">This key will not be shown again.</p>
          <div className="border-border bg-muted/40 mt-4 flex items-center gap-2 rounded-xl border p-3">
            <code className="text-foreground min-w-0 flex-1 break-all font-mono text-xs">{created}</code>
            <button
              onClick={() => void navigator.clipboard.writeText(created)}
              className="text-muted-foreground hover:text-foreground shrink-0 rounded-lg p-1.5"
            >
              <Copy className="size-4" />
            </button>
          </div>
          <button onClick={onClose} className="bg-accent text-accent-foreground mt-4 w-full rounded-xl py-2.5 text-sm font-medium hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-overlay fixed inset-0" onClick={onClose} />
      <div className="border-border bg-background brand-surface relative w-full max-w-md rounded-2xl border p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Create API key</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1"><X className="size-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Key name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile app production" className="border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Environment</label>
            <select value={env} onChange={(e) => setEnv(e.target.value as "production" | "sandbox")} className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Scopes</label>
            <div className="flex flex-wrap gap-2">
              {ALL_SCOPES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleScope(s)}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-xs transition-colors",
                    scopes.includes(s)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button onClick={create} className="bg-accent text-accent-foreground w-full rounded-xl py-2.5 text-sm font-medium hover:opacity-90">
            Generate key
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminApiKeys() {
  const [keys, setKeys] = useState(KEYS);
  const [showCreate, setShowCreate] = useState(false);
  const [revealId, setRevealId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">API keys</h1>
          <p className="text-muted-foreground mt-1 text-sm">Developer credentials, scopes, and usage quotas.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          <Plus className="size-4" />
          New key
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total keys", value: keys.length },
          { label: "Production keys", value: keys.filter((k) => k.environment === "production").length },
          { label: "Total API calls", value: keys.reduce((s, k) => s + k.usageCount, 0).toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {keys.map((key) => (
          <div key={key.id} className="border-border bg-background brand-surface rounded-2xl border p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Key className="text-muted-foreground size-4 shrink-0" />
                  <span className="text-foreground font-semibold">{key.name}</span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    key.environment === "production" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
                  )}>
                    {key.environment}
                  </span>
                </div>

                <div className="border-input bg-muted/40 mt-3 flex items-center gap-2 rounded-xl border p-2.5">
                  <code className="text-foreground flex-1 font-mono text-xs">
                    {revealId === key.id ? key.prefix + "actual_key_hidden" : key.masked}
                  </code>
                  <button
                    onClick={() => setRevealId(revealId === key.id ? null : key.id)}
                    className="text-muted-foreground hover:text-foreground rounded p-1"
                  >
                    {revealId === key.id ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <button
                    onClick={() => void navigator.clipboard.writeText(key.masked)}
                    className="text-muted-foreground hover:text-foreground rounded p-1"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {key.scopes.map((s) => (
                    <span key={s} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">{s}</span>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 gap-1">
                <button title="Rotate key" className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors">
                  <RefreshCw className="size-4" />
                </button>
                <button
                  title="Delete key"
                  onClick={() => setKeys((prev) => prev.filter((k) => k.id !== key.id))}
                  className="text-muted-foreground hover:text-destructive rounded-lg p-1.5 transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
              <span>Created {key.createdAt}</span>
              {key.expiresAt && <span>Expires {key.expiresAt}</span>}
              <span>Last used: {key.lastUsed ?? "never"}</span>
              <span className="ml-auto">{key.usageCount.toLocaleString()} calls</span>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreate={(k) => setKeys((prev) => [k, ...prev])}
        />
      )}
    </div>
  );
}
