"use client";

import { useState } from "react";
import { Download, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type InvoiceStatus = "paid" | "pending" | "overdue" | "draft" | "void";

interface Invoice {
  id: string;
  number: string;
  customer: string;
  email: string;
  amount: string;
  tax: string;
  total: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
}

const INVOICES: Invoice[] = [
  { id: "1", number: "INV-2026-0042", customer: "Alex Johnson", email: "alex@example.com", amount: "₹253.39", tax: "₹45.61", total: "₹299", status: "paid", issuedAt: "2026-04-07", dueAt: "2026-04-21", paidAt: "2026-04-07" },
  { id: "2", number: "INV-2026-0041", customer: "James Wilson", email: "james@example.com", amount: "₹2,033.05", tax: "₹365.95", total: "₹2,399", status: "paid", issuedAt: "2026-04-06", dueAt: "2026-04-20", paidAt: "2026-04-06" },
  { id: "3", number: "INV-2026-0040", customer: "Emma Davis", email: "emma@example.com", amount: "₹2,033.05", tax: "₹365.95", total: "₹2,399", status: "paid", issuedAt: "2026-04-04", dueAt: "2026-04-18", paidAt: "2026-04-04" },
  { id: "4", number: "INV-2026-0039", customer: "Sofia Chen", email: "sofia@example.com", amount: "₹253.39", tax: "₹45.61", total: "₹299", status: "overdue", issuedAt: "2026-03-20", dueAt: "2026-04-03", paidAt: null },
  { id: "5", number: "INV-2026-0038", customer: "Tom Brown", email: "tom@example.com", amount: "₹83.9", tax: "₹15.10", total: "₹99", status: "void", issuedAt: "2026-04-05", dueAt: "2026-04-19", paidAt: null },
];

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  overdue: "bg-destructive/15 text-destructive",
  draft: "bg-muted text-muted-foreground",
  void: "bg-muted/50 text-muted-foreground line-through",
};

const TAX_RATES = [
  { category: "Digital services (India)", rate: "18%", regime: "GST" },
  { category: "Physical goods", rate: "12%", regime: "GST" },
  { category: "EU customers", rate: "Varies (OSS)", regime: "EU VAT" },
  { category: "US customers", rate: "0% (SaaS exempt)", regime: "State tax" },
];

export function AdminInvoicing() {
  const [filter, setFilter] = useState<InvoiceStatus | "">("");
  const visible = filter ? INVOICES.filter((i) => i.status === filter) : INVOICES;

  const totalCollected = INVOICES.filter((i) => i.status === "paid").reduce((_s, i) => _s + parseInt(i.total.replace(/[₹,]/g, ""), 10), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Invoicing & tax</h1>
          <p className="text-muted-foreground mt-1 text-sm">Tax IDs, invoice runs, and export packages for finance.</p>
        </div>
        <button className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="size-4" />
          New invoice
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total collected", value: `₹${totalCollected.toLocaleString("en-IN")}`, color: "text-success" },
          { label: "Invoices issued", value: INVOICES.length, color: "text-foreground" },
          { label: "Overdue", value: INVOICES.filter((i) => i.status === "overdue").length, color: "text-destructive" },
          { label: "Tax collected (est.)", value: "₹823", color: "text-warning" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        {(["", "paid", "pending", "overdue", "void"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s as InvoiceStatus | "")}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === s ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Invoice", "Customer", "Subtotal", "Tax (18%)", "Total", "Status", "Issued", "Due", ""].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="text-muted-foreground size-4" />
                      <code className="text-foreground text-xs">{inv.number}</code>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-foreground font-medium">{inv.customer}</p>
                    <p className="text-muted-foreground text-xs">{inv.email}</p>
                  </td>
                  <td className="text-muted-foreground px-5 py-3 tabular-nums">{inv.amount}</td>
                  <td className="text-muted-foreground px-5 py-3 tabular-nums">{inv.tax}</td>
                  <td className="text-foreground px-5 py-3 font-semibold tabular-nums">{inv.total}</td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[inv.status])}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-5 py-3 text-xs">{inv.issuedAt}</td>
                  <td className="text-muted-foreground px-5 py-3 text-xs">{inv.dueAt}</td>
                  <td className="px-5 py-3">
                    <button className="text-muted-foreground hover:text-foreground rounded-lg p-1.5" title="Download PDF">
                      <Download className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax settings */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground font-semibold">Tax rate configuration</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Category", "Rate", "Regime"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {TAX_RATES.map((t) => (
                <tr key={t.category}>
                  <td className="text-foreground px-5 py-3">{t.category}</td>
                  <td className="px-5 py-3"><span className="bg-warning/15 text-warning rounded-full px-2 py-0.5 text-xs font-semibold">{t.rate}</span></td>
                  <td className="px-5 py-3"><span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">{t.regime}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
