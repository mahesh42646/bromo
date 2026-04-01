"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAVIGATION } from "@/config/admin-navigation";
import { cn } from "@/lib/utils/cn";

export function AdminSidebar({ adminTitle }: { adminTitle: string }) {
  const pathname = usePathname();

  return (
    <aside className="border-border bg-background brand-surface hidden w-64 shrink-0 flex-col border-r md:flex">
      <div className="border-border flex h-14 items-center border-b px-4">
        <Link href="/admin/dashboard" className="text-foreground font-semibold tracking-tight">
          {adminTitle}
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        {ADMIN_NAVIGATION.map((group) => (
          <div key={group.label}>
            <p className="text-muted-foreground mb-2 px-2 text-xs font-medium uppercase tracking-wide">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "text-muted-foreground flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                        active
                          ? "bg-muted text-foreground font-medium"
                          : "hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
