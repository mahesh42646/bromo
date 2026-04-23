"use client";

import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { logoutAction } from "@/app/admin/logout/actions";
import { getAdminPageMeta, ADMIN_NAVIGATION } from "@/config/admin-navigation";

function getGroupLabel(pathname: string): string {
  for (const group of ADMIN_NAVIGATION) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return group.label;
      }
    }
  }
  return "";
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
    >
      <LogOut className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}

export function AdminTopBar({
  adminTitle,
  sessionTtl,
  onMenuClick,
}: {
  adminTitle: string;
  sessionTtl: string;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const { title } = getAdminPageMeta(pathname);
  const groupLabel = getGroupLabel(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 md:px-6">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground md:hidden"
        >
          <Menu className="size-4" />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="hidden text-muted-foreground md:block">{adminTitle}</span>
          {groupLabel && (
            <>
              <span className="text-muted-foreground/40 hidden md:block">/</span>
              <span className="text-muted-foreground hidden capitalize md:block">{groupLabel}</span>
            </>
          )}
          <span className="text-muted-foreground/40 hidden md:block">/</span>
          <span className="truncate font-medium text-foreground">{title}</span>
        </nav>
      </div>

      {/* Right: session + logout */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground md:flex">
          <span className="size-1.5 rounded-full bg-success" />
          Session · {sessionTtl}
        </span>
        <form action={logoutAction}>
          <LogoutButton />
        </form>
      </div>
    </header>
  );
}
