import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShellClient } from "@/components/dashboard/dashboard-shell-client";
import { apiWithAuth, fetchMeServer } from "@/lib/server-api";

async function getUnreadCount(): Promise<number> {
  const r = await apiWithAuth("/notifications/unread-count");
  if (!r.ok) return 0;
  const j = (await r.json().catch(() => ({}))) as { count?: number };
  return typeof j.count === "number" ? j.count : 0;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await fetchMeServer();
  if (!user) {
    redirect("/login?next=/dashboard");
  }
  const unreadCount = await getUnreadCount();
  return (
    <DashboardShellClient user={user} unreadCount={unreadCount}>
      {children}
    </DashboardShellClient>
  );
}
