"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Send } from "lucide-react";
import { site } from "@/config/site";

const categories = [
  { value: "account", label: "Account & login" },
  { value: "billing", label: "Billing & wallet" },
  { value: "technical", label: "Technical issue" },
  { value: "safety", label: "Safety & abuse" },
  { value: "partnership", label: "Partnership / press" },
  { value: "general", label: "General" },
] as const;

export function SupportTicketForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      subject: String(fd.get("subject") ?? "").trim(),
      category: String(fd.get("category") ?? "general"),
      message: String(fd.get("message") ?? "").trim(),
    };
    try {
      const res = await fetch("/api/support-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setStatus("err");
        setMessage(data.message ?? "Could not submit ticket");
        return;
      }
      setStatus("ok");
      setMessage("Thanks — we received your ticket and will reply by email.");
      e.currentTarget.reset();
    } catch {
      setStatus("err");
      setMessage("Network error. Try again or email us directly.");
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={(ev) => void onSubmit(ev)}
      className="mx-auto max-w-lg space-y-4 rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6 sm:p-8"
    >
      <p className="text-sm text-[var(--foreground-muted)]">
        Logged-in users can reference the same email as their Bromo account. For urgent security issues, email{" "}
        <a href={`mailto:${site.supportEmail}`} className="text-[var(--accent)] hover:underline">
          {site.supportEmail}
        </a>
        .
      </p>
      {message ? (
        <p
          className={
            status === "ok"
              ? "rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]"
              : "rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
          }
        >
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="t-name" className="text-xs font-medium text-[var(--foreground-muted)]">
            Name
          </label>
          <input
            id="t-name"
            name="name"
            required
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="t-email" className="text-xs font-medium text-[var(--foreground-muted)]">
            Email
          </label>
          <input
            id="t-email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </div>
      <div>
        <label htmlFor="t-subject" className="text-xs font-medium text-[var(--foreground-muted)]">
          Subject
        </label>
        <input
          id="t-subject"
          name="subject"
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <div>
        <label htmlFor="t-cat" className="text-xs font-medium text-[var(--foreground-muted)]">
          Category
        </label>
        <select
          id="t-cat"
          name="category"
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="t-msg" className="text-xs font-medium text-[var(--foreground-muted)]">
          Message
        </label>
        <textarea
          id="t-msg"
          name="message"
          required
          rows={6}
          className="mt-1 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
      >
        {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Submit ticket
      </button>
      <p className="text-xs text-[var(--foreground-subtle)]">
        By submitting, you agree we may contact you about this request. Set{" "}
        <code className="rounded bg-[var(--surface-high)] px-1">SUPPORT_TICKET_WEBHOOK_URL</code> on the server to forward
        tickets to Slack, Zendesk, or your help desk.
      </p>
    </motion.form>
  );
}
