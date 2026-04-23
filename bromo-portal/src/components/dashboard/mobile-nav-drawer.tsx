"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { site } from "@/config/site";
import { dashboardNav } from "@/components/dashboard/dashboard-nav";
import { useDashboardLogout } from "@/hooks/use-dashboard-logout";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MobileNavDrawer({ open, onClose }: Props) {
  const pathname = usePathname();
  const logout = useDashboardLogout();

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="dash-sidebar-surface fixed inset-y-0 left-0 z-50 flex w-[min(20rem,92vw)] flex-col rounded-r-[2rem] shadow-2xl md:hidden"
            initial={{ x: "-105%" }}
            animate={{ x: 0 }}
            exit={{ x: "-105%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between px-5 py-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-[var(--accent)] to-rose-500 text-sm font-bold text-white">
                  {site.name.slice(0, 1)}
                </div>
                <span className="font-semibold">{site.name}</span>
              </div>
              <button
                type="button"
                className="rounded-xl p-2 text-[var(--foreground-muted)] hover:bg-white/5"
                onClick={onClose}
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
              {dashboardNav.map((item) => {
                const active =
                  pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3.5 text-sm transition-colors",
                      active
                        ? "bg-linear-to-r from-[var(--accent)] to-[#e11d48] font-semibold text-white shadow-lg shadow-[var(--accent)]/25"
                        : "text-[var(--foreground-muted)] hover:bg-white/[0.04]",
                    )}
                  >
                    <Icon className="size-[1.15rem]" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-white/[0.06] px-3 py-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  void logout();
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-[#f97316]"
              >
                <LogOut className="size-[1.15rem]" />
                Log out
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
