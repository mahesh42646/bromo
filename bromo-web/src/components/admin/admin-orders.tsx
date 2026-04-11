"use client";

import { useState } from "react";
import { CreditCard, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type OrderStatus = "pending" | "processing" | "completed" | "refunded" | "failed";

interface Order {
  id: string;
  user: string;
  email: string;
  item: string;
  amount: string;
  currency: string;
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
}

const ORDERS: Order[] = [
  { id: "ORD-8421", user: "Alex Johnson", email: "alex@example.com", item: "Bromo Pro — Monthly", amount: "₹299", currency: "INR", status: "completed", paymentMethod: "UPI", createdAt: "2026-04-07 09:12" },
  { id: "ORD-8420", user: "Maria Garcia", email: "maria@example.com", item: "Creator Badge", amount: "₹99", currency: "INR", status: "processing", paymentMethod: "Card", createdAt: "2026-04-07 08:44" },
  { id: "ORD-8419", user: "James Wilson", email: "james@example.com", item: "Bromo Pro — Annual", amount: "₹2,399", currency: "INR", status: "completed", paymentMethod: "Netbanking", createdAt: "2026-04-06 20:30" },
  { id: "ORD-8418", user: "Sofia Chen", email: "sofia@example.com", item: "Bromo Pro — Monthly", amount: "₹299", currency: "INR", status: "refunded", paymentMethod: "Card", createdAt: "2026-04-06 14:00" },
  { id: "ORD-8417", user: "Tom Brown", email: "tom@example.com", item: "Creator Badge", amount: "₹99", currency: "INR", status: "failed", paymentMethod: "UPI", createdAt: "2026-04-05 11:20" },
  { id: "ORD-8416", user: "Emma Davis", email: "emma@example.com", item: "Bromo Pro — Annual", amount: "₹2,399", currency: "INR", status: "completed", paymentMethod: "Card", createdAt: "2026-04-04 09:00" },
];

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-warning/15 text-warning",
  processing: "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
  refunded: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

export function AdminOrders() {
  const [filter, setFilter] = useState<OrderStatus | "">("");

  const visible = filter ? ORDERS.filter((o) => o.status === filter) : ORDERS;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1 text-sm">Order pipeline, fulfillment states, and exception handling.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Orders today", value: "14", icon: ShoppingCart, color: "text-foreground" },
          { label: "Revenue today", value: "₹8,240", icon: TrendingUp, color: "text-success" },
          { label: "Pending", value: ORDERS.filter((o) => o.status === "pending").length, icon: Package, color: "text-warning" },
          { label: "Refunds", value: ORDERS.filter((o) => o.status === "refunded").length, icon: CreditCard, color: "text-destructive" },
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
        {(["", "pending", "processing", "completed", "refunded", "failed"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s as OrderStatus | "")}
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
                {["Order", "Customer", "Item", "Amount", "Payment", "Status", "Time"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((order) => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3"><code className="text-muted-foreground text-xs">{order.id}</code></td>
                  <td className="px-5 py-3">
                    <p className="text-foreground font-medium">{order.user}</p>
                    <p className="text-muted-foreground text-xs">{order.email}</p>
                  </td>
                  <td className="text-foreground px-5 py-3">{order.item}</td>
                  <td className="text-foreground px-5 py-3 font-semibold tabular-nums">{order.amount}</td>
                  <td className="px-5 py-3"><span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]">{order.paymentMethod}</span></td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[order.status])}>
                      {order.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-5 py-3 text-xs">{order.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
