"use client";

import { useState, useCallback } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopBar } from "./admin-top-bar";

interface AdminShellProps {
  adminTitle: string;
  sessionTtl: string;
  email?: string;
  role?: string;
  maintenanceMessage?: string | null;
  densityClass: string;
  brandSurface: string;
  brandHeadingCase: string;
  children: React.ReactNode;
}

export function AdminShell({
  adminTitle,
  sessionTtl,
  email,
  role,
  maintenanceMessage,
  densityClass,
  brandSurface,
  brandHeadingCase,
  children,
}: AdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const openSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const toggleCollapse = useCallback(() => setSidebarCollapsed((c) => !c), []);

  return (
    <div
      className={`bg-background flex h-screen max-h-screen overflow-hidden ${densityClass}`}
      data-brand-surface={brandSurface}
      data-brand-heading-case={brandHeadingCase}
    >
      {mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default bg-black/70 backdrop-blur-sm md:hidden"
          aria-label="Close sidebar"
          onClick={closeSidebar}
        />
      )}

      <AdminSidebar
        adminTitle={adminTitle}
        email={email}
        role={role}
        mobileOpen={mobileSidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={closeSidebar}
        onToggleCollapse={toggleCollapse}
      />

      <div className="flex min-w-0 flex-1 flex-col max-h-screen">
        <AdminTopBar
          adminTitle={adminTitle}
          sessionTtl={sessionTtl}
          onMenuClick={openSidebar}
        />
        {maintenanceMessage && (
          <div className="shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">
            {maintenanceMessage}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
