"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Flame, X } from "lucide-react";
import { ADMIN_NAVIGATION } from "@/config/admin-navigation";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  adminTitle: string;
  email?: string;
  role?: string;
  mobileOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function AdminSidebar(props: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "relative hidden md:flex flex-col shrink-0 overflow-hidden",
          "border-r border-border bg-surface transition-[width] duration-300 ease-in-out",
          props.collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarInner {...props} pathname={pathname} isMobile={false} />
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col md:hidden",
          "border-r border-border bg-surface shadow-2xl shadow-black/40",
          "transition-transform duration-300 ease-in-out",
          props.mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarInner {...props} pathname={pathname} isMobile collapsed={false} />
      </aside>
    </>
  );
}

function SidebarInner({
  adminTitle,
  email,
  role,
  collapsed,
  onClose,
  onToggleCollapse,
  pathname,
  isMobile,
}: SidebarProps & { pathname: string; isMobile: boolean }) {
  const isIconOnly = collapsed && !isMobile;

  return (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border",
          isIconOnly ? "justify-center px-0" : "justify-between px-4",
        )}
      >
        {isIconOnly ? (
          <Link
            href="/admin/dashboard"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/20 transition-opacity hover:opacity-80"
            title={adminTitle}
          >
            <Flame className="size-[15px] text-accent" />
          </Link>
        ) : (
          <>
            <Link
              href="/admin/dashboard"
              onClick={onClose}
              className="flex min-w-0 items-center gap-2.5"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/20">
                <Flame className="size-[14px] text-accent" />
              </div>
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                {adminTitle}
              </span>
            </Link>

            {isMobile ? (
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : (
              <button
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <div className={cn("space-y-5", isIconOnly ? "px-2" : "px-3")}>
          {ADMIN_NAVIGATION.map((group, gi) => (
            <div key={group.label}>
              {isIconOnly ? (
                gi > 0 && <div className="mb-3 h-px bg-border" />
              ) : (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        title={isIconOnly ? item.title : undefined}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-xl py-2 text-sm transition-all duration-150",
                          isIconOnly ? "justify-center px-2" : "px-2.5",
                          active
                            ? "bg-accent/10 text-accent font-medium"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        )}
                      >
                        {active && !isIconOnly && (
                          <span className="absolute inset-y-[5px] left-0 w-[3px] rounded-full bg-accent" />
                        )}
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-accent" : "opacity-60",
                          )}
                          aria-hidden
                        />
                        {!isIconOnly && (
                          <span className="truncate">{item.title}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Expand button when icon-only */}
      {isIconOnly && (
        <div className="shrink-0 border-t border-border px-2 py-3">
          <button
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="flex w-full items-center justify-center rounded-xl py-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* User footer */}
      {!isIconOnly && (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent ring-1 ring-accent/20">
              {(email ?? "A").slice(0, 1).toUpperCase()}
            </div>
            {email && (
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-foreground">{email}</p>
                {role && (
                  <p className="text-[10px] capitalize text-muted-foreground">{role}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
