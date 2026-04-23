import type { Metadata } from "next";
import { DashboardOverview, type OverviewStats } from "@/components/dashboard/dashboard-overview";
import { apiWithAuth, fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Overview",
};

type UnreadRes = { count?: number };
type GridStats = {
  postCount?: number;
  reelCount?: number;
  gridTotal?: number;
  totalViews?: number;
};
type DraftsRes = { drafts?: unknown[] };

export default async function DashboardHomePage() {
  const user = await fetchMeServer();
  if (!user) return null;

  const [unreadRes, gridRes, draftsRes, promosRes] = await Promise.all([
    apiWithAuth("/notifications/unread-count"),
    apiWithAuth(`/posts/user/${user._id}/grid-stats`),
    apiWithAuth("/drafts/"),
    apiWithAuth("/promotions/mine"),
  ]);

  const unread = unreadRes.ok ? ((await unreadRes.json()) as UnreadRes) : { count: 0 };
  const grid = gridRes.ok ? ((await gridRes.json()) as GridStats) : {};
  const drafts = draftsRes.ok ? ((await draftsRes.json()) as DraftsRes) : { drafts: [] };
  const promosJson = promosRes.ok ? await promosRes.json().catch(() => ({})) : {};
  const promoList = Array.isArray((promosJson as { campaigns?: unknown[] }).campaigns)
    ? (promosJson as { campaigns: unknown[] }).campaigns
    : [];

  const draftCount = Array.isArray(drafts.drafts) ? drafts.drafts.length : 0;

  const stats: OverviewStats = {
    gridTotal: grid.gridTotal ?? user.postsCount ?? 0,
    postCount: grid.postCount ?? 0,
    reelCount: grid.reelCount ?? 0,
    totalViews: grid.totalViews ?? 0,
    draftCount,
    promoCount: promoList.length,
    unreadCount: unread.count ?? 0,
    hasStore: Boolean(user.storeId),
  };

  return <DashboardOverview stats={stats} />;
}
