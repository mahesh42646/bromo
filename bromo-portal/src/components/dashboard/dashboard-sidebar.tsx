"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { site } from "@/config/site";
import { dashboardNav } from "@/components/dashboard/dashboard-nav";
import { useDashboardLogout } from "@/hooks/use-dashboard-logout";
import { cn } from "@/lib/cn";

export function DashboardSidebar() {
  const pathname = usePathname();
  const logout = useDashboardLogout();

  return (
    <aside className="dash-sidebar-surface sticky top-0 hidden h-svh max-h-screen w-64 shrink-0 flex-col overflow-hidden rounded-r-[2rem] md:flex lg:w-72">
      <div className="flex shrink-0 items-center gap-3 px-5 py-7">
        <div className="relative">
          <div className="absolute -inset-1 rounded-2xl bg-linear-to-br from-[var(--accent)] to-violet-600 opacity-60 blur-md" />
          <div className="relative flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-[var(--accent)] to-rose-500 text-lg font-bold text-white shadow-lg">
            {site.name.slice(0, 1)}
          </div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">{site.name}</p>
          <p className="text-xs text-[var(--foreground-subtle)]">Creator suite</p>
        </div>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 pb-2"
        aria-label="Dashboard"
      >
        {dashboardNav.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="relative block rounded-2xl px-2 py-0.5">
              {active ? (
                <motion.span
                  layoutId="dash-sidebar-active"
                  className="absolute inset-0 rounded-2xl bg-linear-to-r from-[var(--accent)] to-[#e11d48] shadow-[0_8px_28px_-8px_rgba(255,77,109,0.65)]"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              ) : null}
              <span
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors",
                  active
                    ? "font-semibold text-white"
                    : "text-[var(--foreground-muted)] hover:bg-white/[0.04] hover:text-[var(--foreground)]",
                )}
              >
                <Icon className={cn("size-[1.15rem] shrink-0", active ? "opacity-100" : "opacity-75")} aria-hidden />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 space-y-1 border-t border-white/[0.06] px-3 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--foreground)]"
        >
          ← Marketing site
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-[#f97316] transition-colors hover:bg-[#f97316]/10"
        >
          <LogOut className="size-[1.15rem]" />
          Log out
        </button>
      </div>
    </aside>
  );
}
