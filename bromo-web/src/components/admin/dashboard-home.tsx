import Link from "next/link";
import { flattenAdminNavItems } from "@/config/admin-navigation";
import { ArrowRight, BarChart3, Shield, Ticket, Users } from "lucide-react";

const statPlaceholders = [
  { label: "Platform users", value: "—", hint: "Live when wired", icon: Users },
  { label: "Open tickets", value: "—", hint: "Support queue", icon: Ticket },
  { label: "Audit events (24h)", value: "—", hint: "Security trail", icon: Shield },
  { label: "Active sessions", value: "—", hint: "Admin + API", icon: BarChart3 },
];

export function DashboardHome({
  platformName,
  appTitle,
}: {
  platformName: string;
  appTitle: string;
}) {
  const links = flattenAdminNavItems().filter((i) => i.href !== "/admin/dashboard");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {platformName} overview and quick entry to every admin area for {appTitle}.
        </p>
      </div>

      <section aria-label="Overview metrics">
        <h2 className="text-foreground mb-3 text-sm font-medium">Analytics snapshot</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statPlaceholders.map(({ label, value, hint, icon: Icon }) => (
            <div
              key={label}
              className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm"
            >
              <div className="text-muted-foreground flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                <Icon className="size-4 opacity-70" aria-hidden />
              </div>
              <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
              <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Quick links">
        <h2 className="text-foreground mb-3 text-sm font-medium">All admin areas</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="border-border bg-background brand-surface hover:bg-muted/50 group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors"
              >
                <span className="text-foreground font-medium">{item.title}</span>
                <ArrowRight
                  className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
