import type { Metadata } from "next";
import { markAllNotificationsRead } from "@/app/actions/notifications";
import { NotificationsInboxClient, type InboxNotification } from "@/components/dashboard/notifications-inbox-client";
import { apiWithAuth, fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const user = await fetchMeServer();
  if (!user) return null;

  const res = await apiWithAuth("/notifications?page=1");
  const data = res.ok ? await res.json().catch(() => ({})) : {};
  const notifications: InboxNotification[] = Array.isArray(data.notifications) ? data.notifications : [];
  const unreadCount = typeof data.unreadCount === "number" ? data.unreadCount : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Live inbox synced from Bromo — refreshes while you work and when you return to this tab.
          </p>
        </div>
        <form action={markAllNotificationsRead}>
          <button
            type="submit"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]/40"
          >
            Mark all read
          </button>
        </form>
      </div>

      <NotificationsInboxClient initialNotifications={notifications} initialUnread={unreadCount} />
    </div>
  );
}
