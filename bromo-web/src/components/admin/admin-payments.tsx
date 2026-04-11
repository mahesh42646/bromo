"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CreditCard, RefreshCw, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type PaymentStatus = "succeeded" | "failed" | "refunded" | "pending";

interface Payment {
  id: string;
  orderId: string;
  user: string;
  amount: string;
  fee: string;
  net: string;
  method: string;
  provider: "razorpay" | "stripe" | "upi";
  status: PaymentStatus;
  createdAt: string;
}

const PAYMENTS: Payment[] = [
  { id: "pay_QxR8k", orderId: "ORD-8421", user: "Alex Johnson", amount: "₹299", fee: "₹8.96", net: "₹290.04", method: "UPI", provider: "razorpay", status: "succeeded", createdAt: "2026-04-07 09:12" },
  { id: "pay_QxR7j", orderId: "ORD-8420", user: "Maria Garcia", amount: "₹99", fee: "₹2.97", net: "₹96.03", method: "Visa •4242", provider: "stripe", status: "pending", createdAt: "2026-04-07 08:44" },
  { id: "pay_QxR6i", orderId: "ORD-8419", user: "James Wilson", amount: "₹2,399", fee: "₹71.97", net: "₹2,327.03", method: "HDFC Netbanking", provider: "razorpay", status: "succeeded", createdAt: "2026-04-06 20:30" },
  { id: "pay_QxR5h", orderId: "ORD-8418", user: "Sofia Chen", amount: "₹299", fee: "₹0", net: "₹0", method: "Mastercard •9876", provider: "stripe", status: "refunded", createdAt: "2026-04-06 14:00" },
  { id: "pay_QxR4g", orderId: "ORD-8417", user: "Tom Brown", amount: "₹99", fee: "₹0", net: "₹0", method: "UPI", provider: "upi", status: "failed", createdAt: "2026-04-05 11:20" },
];

const STATUS_STYLES: Record<PaymentStatus, string> = {
  succeeded: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  refunded: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
};

const PROVIDER_COLORS: Record<Payment["provider"], string> = {
  razorpay: "bg-[#072654]/15 text-[#3395FF]",
  stripe: "bg-[#6772e5]/15 text-[#6772e5]",
  upi: "bg-success/15 text-success",
};

export function AdminPayments() {
  const [filter, setFilter] = useState<PaymentStatus | "">("");

  const visible = filter ? PAYMENTS.filter((p) => p.status === filter) : PAYMENTS;
  const volume = PAYMENTS.filter((p) => p.status === "succeeded").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-muted-foreground mt-1 text-sm">Payment intents, chargebacks, and reconciliation with PSP dashboards.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Volume today", value: "₹3,096", icon: TrendingUp, color: "text-success" },
          { label: "Successful", value: volume, icon: ArrowUpRight, color: "text-success" },
          { label: "Failed", value: PAYMENTS.filter((p) => p.status === "failed").length, icon: ArrowDownLeft, color: "text-destructive" },
          { label: "Refunds", value: PAYMENTS.filter((p) => p.status === "refunded").length, icon: RefreshCw, color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <div className="text-muted-foreground flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              <Icon className={cn("size-4 opacity-70", color)} />
            </div>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        {(["", "succeeded", "pending", "refunded", "failed"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s as PaymentStatus | "")}
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
                {["Payment ID", "Order", "Customer", "Amount", "Fee", "Net", "Method", "PSP", "Status", "Time"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-muted-foreground font-mono text-xs">{p.id}</code></td>
                  <td className="px-5 py-3"><code className="text-muted-foreground text-xs">{p.orderId}</code></td>
                  <td className="text-foreground px-5 py-3">{p.user}</td>
                  <td className="text-foreground px-5 py-3 font-semibold tabular-nums">{p.amount}</td>
                  <td className="text-muted-foreground px-5 py-3 tabular-nums">{p.fee}</td>
                  <td className="text-foreground px-5 py-3 font-medium tabular-nums">{p.net}</td>
                  <td className="text-muted-foreground px-5 py-3 text-xs"><CreditCard className="mr-1 inline size-3" />{p.method}</td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PROVIDER_COLORS[p.provider])}>
                      {p.provider}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[p.status])}>
                      {p.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-5 py-3 text-xs">{p.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
