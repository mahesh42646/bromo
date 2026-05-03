"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Plug, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
type IntegrationCategory = "auth" | "storage" | "messaging" | "analytics" | "payments" | "monitoring";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  category: IntegrationCategory;
  lastSync: string | null;
  configFields?: { label: string; value: string; masked?: boolean }[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: "firebase",
    name: "Firebase",
    description: "Authentication, Firestore, and real-time database for the Bromo mobile app.",
    status: "connected",
    category: "auth",
    lastSync: "2 minutes ago",
    configFields: [{ label: "Project ID", value: "bromo-prod-42x8" }, { label: "Auth domain", value: "bromo-prod.firebaseapp.com" }],
  },
  {
    id: "mongodb",
    name: "MongoDB Atlas",
    description: "Primary database for user profiles, content metadata, stores, and promotions.",
    status: "connected",
    category: "storage",
    lastSync: "Just now",
    configFields: [{ label: "Cluster", value: "bromo-prod-cluster.mongodb.net" }, { label: "Database", value: "bromo_admin" }],
  },
  {
    id: "cloudinary",
    name: "Cloudinary",
    description: "Media CDN for images, videos, and transformations across the platform.",
    status: "connected",
    category: "storage",
    lastSync: "1 hour ago",
    configFields: [{ label: "Cloud name", value: "bromo-media" }],
  },
  {
    id: "fcm",
    name: "FCM / APNs",
    description: "Firebase Cloud Messaging and Apple Push Notification Service for mobile push.",
    status: "connected",
    category: "messaging",
    lastSync: "5 minutes ago",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payment processing, subscription billing, and invoice management.",
    status: "disconnected",
    category: "payments",
    lastSync: null,
  },
  {
    id: "mixpanel",
    name: "Mixpanel",
    description: "Product analytics, funnels, and cohort analysis for growth teams.",
    status: "disconnected",
    category: "analytics",
    lastSync: null,
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Error monitoring, performance tracing, and crash reporting.",
    status: "error",
    category: "monitoring",
    lastSync: "3 days ago",
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Transactional email delivery and template management.",
    status: "pending",
    category: "messaging",
    lastSync: null,
  },
];

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; style: string; icon: React.ComponentType<{ className?: string }> }> = {
  connected: { label: "Connected", style: "text-success bg-success/15", icon: CheckCircle2 },
  disconnected: { label: "Not connected", style: "text-muted-foreground bg-muted", icon: XCircle },
  error: { label: "Error", style: "text-destructive bg-destructive/15", icon: XCircle },
  pending: { label: "Pending", style: "text-warning bg-warning/15", icon: Plug },
};

const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  auth: "Authentication",
  storage: "Storage",
  messaging: "Messaging",
  analytics: "Analytics",
  payments: "Payments",
  monitoring: "Monitoring",
};

const CATEGORY_ICONS: Record<IntegrationCategory, string> = {
  auth: "🔑",
  storage: "🗄️",
  messaging: "📨",
  analytics: "📊",
  payments: "💳",
  monitoring: "🔍",
};

export function AdminIntegrations() {
  const [filter, setFilter] = useState<IntegrationCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<IntegrationStatus | "">("");

  const visible = INTEGRATIONS.filter((i) => {
    if (filter && i.category !== filter) return false;
    if (statusFilter && i.status !== statusFilter) return false;
    return true;
  });

  const stats = [
    { label: "Connected", value: INTEGRATIONS.filter((i) => i.status === "connected").length, color: "text-success" },
    { label: "Disconnected", value: INTEGRATIONS.filter((i) => i.status === "disconnected").length, color: "text-muted-foreground" },
    { label: "Errors", value: INTEGRATIONS.filter((i) => i.status === "error").length, color: "text-destructive" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1 text-sm">Third-party connectors, credential rotation, and partner scopes.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={filter} onChange={(e) => setFilter(e.target.value as IntegrationCategory | "")} className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">All categories</option>
          {(Object.keys(CATEGORY_LABEL) as IntegrationCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IntegrationStatus | "")} className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">All status</option>
          <option value="connected">Connected</option>
          <option value="disconnected">Disconnected</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((integration) => {
          const sc = STATUS_CONFIG[integration.status];
          const StatusIcon = sc.icon;
          return (
            <div key={integration.id} className="border-border bg-background brand-surface flex flex-col rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex size-10 items-center justify-center rounded-xl text-lg">
                    {CATEGORY_ICONS[integration.category]}
                  </div>
                  <div>
                    <p className="text-foreground font-semibold">{integration.name}</p>
                    <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium">
                      {CATEGORY_LABEL[integration.category]}
                    </span>
                  </div>
                </div>
                <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0", sc.style)}>
                  <StatusIcon className="size-3" />
                  {sc.label}
                </span>
              </div>

              <p className="text-muted-foreground mt-3 flex-1 text-sm">{integration.description}</p>

              {integration.configFields && (
                <dl className="border-border mt-4 space-y-1.5 rounded-xl border p-3">
                  {integration.configFields.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2 text-xs">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-foreground font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {integration.lastSync && (
                <p className="text-muted-foreground mt-3 text-xs">Last sync: {integration.lastSync}</p>
              )}

              <div className="mt-4 flex gap-2">
                <button className={cn(
                  "flex-1 rounded-xl py-2 text-sm font-medium transition-colors",
                  integration.status === "connected"
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "bg-accent text-accent-foreground hover:opacity-90",
                )}>
                  {integration.status === "connected" ? "Disconnect" : "Connect"}
                </button>
                <button className="border-border text-muted-foreground hover:text-foreground rounded-xl border p-2">
                  <ExternalLink className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
