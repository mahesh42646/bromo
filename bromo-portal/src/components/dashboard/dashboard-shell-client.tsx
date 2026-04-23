"use client";

import { useState, type ReactNode } from "react";
import type { DbUser } from "@/types/user";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { MobileNavDrawer } from "@/components/dashboard/mobile-nav-drawer";
import { SessionSync } from "@/components/dashboard/session-sync";

export function DashboardShellClient({
  user,
  unreadCount,
  children,
}: {
  user: DbUser;
  unreadCount: number;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="dash-canvas flex min-h-screen">
      <SessionSync />
      <DashboardSidebar />
      <MobileNavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardTopbar user={user} unreadCount={unreadCount} onOpenMobileNav={() => setMobileOpen(true)} />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
