"use client";

import { useState } from "react";
import { Bell, Mail, MessageSquare, Send, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Channel = "push" | "email" | "in_app";

const HISTORY = [
  { id: "1", title: "Welcome to Bromo!", channel: "push" as Channel, audience: "New users", sent: 1240, opened: 892, ts: "2026-04-06 09:00" },
  { id: "2", title: "New feature: Stories v2", channel: "in_app" as Channel, audience: "All users", sent: 10500, opened: 7840, ts: "2026-04-05 14:00" },
  { id: "3", title: "Your weekly digest", channel: "email" as Channel, audience: "Active users", sent: 8200, opened: 3280, ts: "2026-04-04 08:00" },
  { id: "4", title: "Trending in your area", channel: "push" as Channel, audience: "Location-based", sent: 4300, opened: 2150, ts: "2026-04-03 18:00" },
];

const TEMPLATES = [
  { id: "welcome", label: "Welcome message", body: "Welcome to Bromo! Start sharing your world." },
  { id: "re-engage", label: "Re-engagement", body: "We miss you! See what's new on Bromo." },
  { id: "feature", label: "Feature launch", body: "Exciting new feature just dropped. Check it out!" },
  { id: "digest", label: "Weekly digest", body: "Here's what happened this week on Bromo." },
];

const CHANNEL_ICONS: Record<Channel, React.ComponentType<{ className?: string }>> = {
  push: Smartphone,
  email: Mail,
  in_app: MessageSquare,
};

export function AdminNotifications() {
  const [channel, setChannel] = useState<Channel>("push");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground mt-1 text-sm">Transactional templates, push/email routing, and send windows.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Compose */}
        <div className="border-border bg-background brand-surface col-span-3 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-foreground mb-5 font-semibold">Compose notification</h2>

          {/* Channel selector */}
          <div className="mb-5">
            <label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Channel</label>
            <div className="flex gap-2">
              {(["push", "email", "in_app"] as Channel[]).map((c) => {
                const Icon = CHANNEL_ICONS[c];
                return (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      channel === c
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {c === "in_app" ? "In-app" : c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audience */}
          <div className="mb-4">
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All users (10,500)</option>
              <option value="active">Active users (8,400)</option>
              <option value="new">New users (last 7d) (1,240)</option>
              <option value="inactive">Inactive users (2,100)</option>
              <option value="onboarding">Pending onboarding (890)</option>
            </select>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title…"
              className="border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Body */}
          <div className="mb-5">
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wide">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Notification body…"
              className="border-input bg-background text-foreground placeholder:text-placeholder w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSend()}
              disabled={sending || !title || !body}
              className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="size-4" />
              {sending ? "Sending…" : "Send now"}
            </button>
            {sent && <span className="text-success text-sm font-medium">Sent successfully!</span>}
          </div>
        </div>

        {/* Templates */}
        <div className="border-border bg-background brand-surface col-span-2 rounded-2xl border p-5 shadow-sm">
          <h2 className="text-foreground mb-4 font-semibold">Quick templates</h2>
          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTitle(t.label); setBody(t.body); }}
                className="border-border hover:bg-muted/40 w-full rounded-xl border p-3 text-left transition-colors"
              >
                <p className="text-foreground text-sm font-medium">{t.label}</p>
                <p className="text-muted-foreground mt-0.5 text-xs line-clamp-2">{t.body}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground font-semibold">Send history</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Notification", "Channel", "Audience", "Sent", "Open rate", "Time"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {HISTORY.map((n) => {
                const Icon = CHANNEL_ICONS[n.channel];
                const openRate = Math.round((n.opened / n.sent) * 100);
                return (
                  <tr key={n.id} className="hover:bg-muted/30 transition-colors">
                    <td className="text-foreground px-5 py-3 font-medium">{n.title}</td>
                    <td className="px-5 py-3">
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Icon className="size-3.5" />
                        {n.channel === "in_app" ? "In-app" : n.channel}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-5 py-3 text-xs">{n.audience}</td>
                    <td className="text-foreground px-5 py-3 tabular-nums">{n.sent.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={cn("text-sm font-semibold tabular-nums", openRate > 40 ? "text-success" : "text-warning")}>
                        {openRate}%
                      </span>
                    </td>
                    <td className="text-muted-foreground px-5 py-3 text-xs">{n.ts}</td>
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
