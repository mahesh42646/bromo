"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AtSign,
  Bell,
  Heart,
  MessageCircle,
  Radio,
  UserPlus,
  Video,
} from "lucide-react";
import { publicMediaUrl } from "@/lib/media-url";

type Actor = {
  username?: string;
  displayName?: string;
  profilePicture?: string;
};

export type InboxNotification = {
  _id: string;
  type?: string;
  read?: boolean;
  message?: string;
  createdAt?: string;
  actorId?: Actor | string;
};

function NotifIcon({ type }: { type?: string }) {
  const t = type ?? "";
  const common = "size-4 shrink-0";
  if (t === "like") return <Heart className={`${common} text-rose-400`} />;
  if (t === "comment" || t === "mention") return <MessageCircle className={`${common} text-sky-400`} />;
  if (t === "follow" || t === "follow_request" || t === "follow_accept")
    return <UserPlus className={`${common} text-emerald-400`} />;
  if (t === "message") return <MessageCircle className={`${common} text-violet-400`} />;
  if (t === "media_ready") return <Video className={`${common} text-amber-400`} />;
  if (t === "milestone") return <Radio className={`${common} text-pink-400`} />;
  return <Bell className={`${common} text-[var(--foreground-muted)]`} />;
}

function actorLabel(n: InboxNotification): string {
  const a = n.actorId;
  if (a && typeof a === "object") {
    return a.displayName?.trim() || a.username?.trim() || "Someone";
  }
  return "Someone";
}

function actorAvatar(n: InboxNotification): string | null {
  const a = n.actorId;
  if (a && typeof a === "object" && a.profilePicture) return publicMediaUrl(a.profilePicture);
  return null;
}

export function NotificationsInboxClient({
  initialNotifications,
  initialUnread,
}: {
  initialNotifications: InboxNotification[];
  initialUnread: number;
}) {
  const [items, setItems] = useState(initialNotifications);
  const [unread, setUnread] = useState(initialUnread);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/portal/notifications?page=1", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        notifications?: InboxNotification[];
        unreadCount?: number;
      };
      if (res.ok) {
        if (Array.isArray(data.notifications)) setItems(data.notifications);
        if (typeof data.unreadCount === "number") setUnread(data.unreadCount);
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Bell className="size-4 text-[var(--accent)]" />
          <span className="text-[var(--foreground-muted)]">Unread</span>
          <span className="font-semibold tabular-nums text-[var(--foreground)]">{unread}</span>
          {syncing ? <span className="text-xs text-[var(--foreground-subtle)]">Updating…</span> : null}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)]/40"
        >
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--card)] px-6 py-12 text-center">
          <AtSign className="mx-auto size-10 text-[var(--foreground-subtle)] opacity-40" />
          <p className="mt-3 text-sm font-medium text-[var(--foreground)]">You are all caught up</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            Likes, follows, and shop activity will land here in real time while the app is running.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const av = actorAvatar(n);
            const unreadDot = !n.read;
            return (
              <li
                key={n._id}
                className={`flex gap-3 rounded-2xl border border-[var(--hairline)] px-4 py-3 transition ${
                  unreadDot ? "bg-[var(--accent)]/[0.06] ring-1 ring-[var(--accent)]/20" : "bg-[var(--card)]"
                }`}
              >
                <div className="relative shrink-0">
                  {av ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={av} alt="" className="size-11 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-bold text-[var(--foreground-muted)]">
                      {actorLabel(n).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[var(--background)] shadow">
                    <NotifIcon type={n.type} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-[var(--foreground)]">
                    <span className="font-semibold">{actorLabel(n)}</span>{" "}
                    <span className="text-[var(--foreground-muted)]">{n.message}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-[var(--foreground-subtle)]">
                    <span>{n.type?.replace(/_/g, " ") ?? "activity"}</span>
                    {n.createdAt ? (
                      <>
                        <span>·</span>
                        <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
