"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import type { DbUser } from "@/types/user";
import { DashboardSearch } from "@/components/dashboard/dashboard-search";
import { useDashboardLogout } from "@/hooks/use-dashboard-logout";
import { publicMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/cn";

type Props = {
  user: DbUser;
  unreadCount: number;
  onOpenMobileNav?: () => void;
};

function initials(u: DbUser): string {
  const n = u.displayName?.trim() || u.username || u.email || "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

export function DashboardTopbar({ user, unreadCount, onOpenMobileNav }: Props) {
  const router = useRouter();
  const logout = useDashboardLogout();
  const firstName = user.displayName?.split(/\s+/)[0] ?? "Creator";
  const avatar = publicMediaUrl(user.profilePicture);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[var(--background)]/75 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3">
        <button
          type="button"
          className="inline-flex rounded-xl p-2.5 text-[var(--foreground-muted)] transition-colors hover:bg-white/5 md:hidden"
          aria-label="Open menu"
          onClick={onOpenMobileNav}
        >
          <Menu className="size-5" />
        </button>

        <div className="min-w-0 shrink-0 md:max-w-[200px] lg:max-w-[240px]">
          <p className="truncate text-xs text-[var(--foreground-muted)] sm:text-sm">
            Hi <span className="font-medium text-[var(--foreground)]">{firstName}</span>
          </p>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
        </div>

        <DashboardSearch />

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard/notifications"
            className="relative rounded-xl p-2.5 text-[var(--foreground-muted)] transition-colors hover:bg-white/5 hover:text-[var(--foreground)]"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>

          <div className="hidden h-8 w-px bg-white/10 sm:block" />

          <button
            type="button"
            onClick={() => router.push("/dashboard/profile")}
            className="flex items-center gap-2 rounded-2xl py-1.5 pl-1 pr-2 transition-colors hover:bg-white/5 sm:pr-3"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="size-9 rounded-xl object-cover ring-2 ring-white/10"
                width={36}
                height={36}
              />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-xs font-semibold text-[var(--accent)] ring-2 ring-[var(--accent)]/30">
                {initials(user)}
              </span>
            )}
            <span className="hidden max-w-[120px] truncate text-left text-sm font-medium sm:block">
              {user.displayName || user.username || "Account"}
            </span>
            <ChevronDown className="hidden size-4 text-[var(--foreground-subtle)] sm:block" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              "rounded-xl p-2.5 text-[var(--foreground-muted)] transition-colors hover:bg-white/5 hover:text-[var(--destructive)]",
            )}
            aria-label="Sign out"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
