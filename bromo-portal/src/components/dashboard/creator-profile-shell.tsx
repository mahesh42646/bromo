"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlignJustify,
  BadgeCheck,
  BarChart2,
  Bell,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Coins,
  Film,
  Globe,
  Grid3X3,
  Info,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  PenSquare,
  Play,
  Plus,
  Share2,
  Shield,
  ShoppingBag,
  Sliders,
  Smartphone,
  Store,
  TrendingUp,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { site } from "@/config/site";
import { ContentViewerModal } from "@/components/dashboard/content-viewer-modal";
import { GridMediaPreview } from "@/components/dashboard/grid-media-preview";
import { useDashboardLogout } from "@/hooks/use-dashboard-logout";
import { useProfileGridFeed } from "@/hooks/use-profile-grid-feed";
import { publicMediaUrl } from "@/lib/media-url";
import type { PortalPost } from "@/types/post";
import type { DbUser } from "@/types/user";

export type ProfileGridStats = {
  postCount?: number;
  reelCount?: number;
  gridTotal?: number;
  totalViews?: number;
  totalImpressions?: number;
};

function fmtWalletCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function gridItemAlt(post: PortalPost, fallback: string): string {
  const c = post.caption?.trim();
  if (c) return c.length > 80 ? `${c.slice(0, 80)}…` : c;
  return fallback;
}

type GridTab = "posts" | "reels" | "saved";

function SettingsDrawerRow({
  icon: Icon,
  label,
  sublabel,
  accent,
  href,
  onClick,
  onClose,
}: {
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  accent: string;
  href?: string;
  onClick?: () => void;
  onClose: () => void;
}) {
  const content = (
    <div className="flex items-center gap-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ${accent}`}>
        <Icon className="size-[18px]" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[13px] font-semibold text-white">{label}</div>
        {sublabel ? <div className="mt-0.5 text-[11px] leading-snug text-white/45">{sublabel}</div> : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-white/35" />
    </div>
  );
  const cls =
    "block w-full rounded-xl px-2 py-2.5 transition hover:bg-white/[0.07] active:bg-white/[0.04]";
  if (href?.startsWith("http://") || href?.startsWith("https://")) {
    return (
      <a href={href} className={cls} onClick={onClose} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClose}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`${cls} text-left`}
      onClick={() => {
        onClose();
        onClick?.();
      }}
    >
      {content}
    </button>
  );
}

export function CreatorProfileShell({
  user,
  gridStats,
  editForm,
}: {
  user: DbUser;
  gridStats: ProfileGridStats;
  editForm: ReactNode;
}) {
  const logout = useDashboardLogout();
  const [editOpen, setEditOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gridTab, setGridTab] = useState<GridTab>("reels");
  const [viewerPost, setViewerPost] = useState<PortalPost | null>(null);

  const {
    posts,
    postsLoading,
    postsLoadingMore,
    hasMore,
    postsError,
    sentinelRef,
  } = useProfileGridFeed(user._id, gridTab);

  const displayName = user.displayName?.trim() || user.username || "You";
  const username = user.username?.trim() || "you";
  const avatar = publicMediaUrl(user.profilePicture);
  const postsStat = Math.max(0, gridStats.gridTotal ?? user.postsCount ?? 0);
  const verified = Boolean(user.emailVerified);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/wallet", { cache: "no-store" });
      if (!res.ok) {
        setWalletBalance(0);
        return;
      }
      const data = (await res.json()) as { balance?: number };
      setWalletBalance(typeof data.balance === "number" ? data.balance : 0);
    } catch {
      setWalletBalance(0);
    }
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const openEdit = () => {
    setMenuOpen(false);
    setEditOpen(true);
    requestAnimationFrame(() => {
      document.getElementById("edit-profile-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const shareProfile = async () => {
    const url = `${site.url.replace(/\/+$/, "")}/dashboard/profile`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: displayName, text: `@${username} on ${site.name}`, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  };

  const openWebsite = () => {
    const w = user.website?.trim();
    if (!w) {
      openEdit();
      return;
    }
    const href = /^https?:\/\//i.test(w) ? w : `https://${w}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const proSubtitle =
    gridStats.totalViews != null &&
    gridStats.totalImpressions != null &&
    (gridStats.totalViews > 0 || gridStats.totalImpressions > 0)
      ? `${gridStats.totalViews.toLocaleString()} views · ${gridStats.totalImpressions.toLocaleString()} impressions (all posts & reels) · Wallet & campaigns`
      : "Buy Bromo coins, run promotions, and view content insights";

  const phone = (
    <div className="relative mx-auto w-full max-w-[430px] bg-black text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <header className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <Link
          href="/dashboard"
          className="flex size-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/10"
          aria-label="Back to dashboard"
        >
          <ChevronLeft className="size-6" strokeWidth={2} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold tracking-tight">{username}</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-white/20 px-2 py-1">
            <Coins className="size-3.5 text-amber-400" />
            <span className="text-[11px] font-extrabold tabular-nums text-white/90">
              {walletBalance === null ? "—" : fmtWalletCoins(walletBalance)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/10"
            aria-label="Menu"
          >
            <AlignJustify className="size-[22px]" strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className="px-4 pb-28 pt-4">
        <div className="mb-3.5 flex items-center gap-5">
          <div className="size-[90px] shrink-0 rounded-full border-2 border-pink-500 p-0.5 shadow-[0_0_12px_rgba(236,72,153,0.35)]">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt={`${displayName} profile photo`}
                className="size-full rounded-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center rounded-full bg-pink-500/20 text-3xl font-extrabold text-pink-400">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            <Link href="/dashboard/content" className="block rounded-lg py-1 hover:bg-white/5">
              <div className="text-lg font-bold tabular-nums">{postsStat}</div>
              <div className="text-[12px] text-white/50">Posts</div>
            </Link>
            <div className="block rounded-lg py-1">
              <div className="text-lg font-bold tabular-nums">{user.followersCount ?? 0}</div>
              <div className="text-[12px] text-white/50">Followers</div>
            </div>
            <div className="block rounded-lg py-1">
              <div className="text-lg font-bold tabular-nums">{user.followingCount ?? 0}</div>
              <div className="text-[12px] text-white/50">Following</div>
            </div>
          </div>
        </div>

        <div className="mb-3.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold">{displayName}</span>
            {verified ? <BadgeCheck className="size-4 shrink-0 text-pink-500" fill="currentColor" /> : null}
          </div>
          {user.email ? <p className="text-[13px] text-white/45">{user.email}</p> : null}
          {user.bio?.trim() ? <p className="text-sm leading-5 text-white/90">{user.bio.trim()}</p> : null}
          <button
            type="button"
            onClick={openWebsite}
            className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-pink-500 hover:text-pink-400"
          >
            <Link2 className="size-3.5" />
            <span className="truncate">
              {user.website?.trim() ? user.website.replace(/^https?:\/\//i, "") : "Add a link"}
            </span>
          </button>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 text-[12px] font-medium text-white/55">
              {user.isPrivate ? <Lock className="size-3" /> : <Globe className="size-3" />}
              {user.isPrivate ? "Private" : "Public"}
            </span>
            <span className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] font-medium text-white/55">
              Creator
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={openEdit}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-white/25 bg-white/5 text-[13px] font-semibold hover:bg-white/10"
          >
            <PenSquare className="size-[15px]" />
            Edit profile
          </button>
          <button
            type="button"
            onClick={() => void shareProfile()}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-white/25 bg-white/5 text-[13px] font-semibold hover:bg-white/10"
          >
            <Share2 className="size-[15px]" />
            Share profile
          </button>
        </div>

        <Link
          href="/dashboard"
          className="mt-3.5 block rounded-xl border border-white/10 bg-white/[0.06] p-3.5 transition hover:bg-white/[0.09]"
        >
          <div className="text-[15px] font-extrabold">Creator overview</div>
          <div className="mt-2 flex items-center gap-1.5">
            <TrendingUp className="size-[15px] shrink-0 text-emerald-400" />
            <p className="flex-1 text-[13px] leading-snug text-white/55">{proSubtitle}</p>
            <ChevronRight className="size-[18px] shrink-0 text-white/45" />
          </div>
        </Link>

        {user.storeId ? (
          <Link
            href="/dashboard/store"
            className="mt-3 block rounded-xl border border-pink-500/30 bg-pink-500/10 p-3.5 transition hover:bg-pink-500/[0.14]"
          >
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-[10px] bg-pink-500/20">
                <Store className="size-[17px] text-pink-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold">Manage store</div>
                <div className="mt-0.5 text-xs text-white/55">Products, analytics & storefront</div>
              </div>
              <span className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[10px] font-extrabold text-pink-400">
                STORE OWNER
              </span>
              <ChevronRight className="size-4 text-white/45" />
            </div>
          </Link>
        ) : (
          <Link
            href="/dashboard/store"
            className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3.5 transition hover:bg-white/[0.09]"
          >
            <div className="flex size-9 items-center justify-center rounded-[10px] bg-rose-500/15">
              <ShoppingBag className="size-[18px] text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold">Open your store</div>
              <div className="mt-0.5 text-xs text-white/55">Sell products and reach local customers</div>
            </div>
            <ChevronRight className="size-4 text-white/45" />
          </Link>
        )}

        <div className="mt-4 flex border-t border-white/10">
          {(
            [
              { id: "posts" as const, Icon: Grid3X3 },
              { id: "reels" as const, Icon: Clapperboard },
              { id: "saved" as const, Icon: Bookmark },
            ] as const
          ).map(({ id, Icon }) => {
            const active = gridTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setGridTab(id)}
                className={`flex flex-1 items-center justify-center py-3.5 ${active ? "border-b border-white" : "text-white/45"}`}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 2} />
              </button>
            );
          })}
        </div>

        {postsError ? (
          <p className="py-4 text-center text-xs text-rose-400/90">{postsError}</p>
        ) : null}

        {postsLoading && posts.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/45">Loading…</div>
        ) : (
          <div className="flex flex-wrap">
            <Link
              href="/dashboard/content"
              className="box-border flex w-1/3 aspect-square border border-transparent p-px"
            >
              <div className="flex w-full flex-col items-center justify-center gap-1 border border-white/10 bg-white/[0.06]">
                <Plus className="size-7 text-white/45" />
                <span className="text-[11px] font-semibold tracking-wide text-white/45">New</span>
              </div>
            </Link>
            {posts.map((post) => (
              <div key={post._id} className="box-border w-1/3 p-px">
                <button
                  type="button"
                  onClick={() => setViewerPost(post)}
                  className="relative block w-full aspect-square overflow-hidden bg-white/5"
                  aria-label={gridItemAlt(post, "Open post preview")}
                >
                  <GridMediaPreview
                    post={post}
                    alt={gridItemAlt(post, `${post.type === "reel" ? "Reel" : "Post"} thumbnail`)}
                    className="pointer-events-none size-full object-cover"
                  />
                  {(post.type === "reel" || post.mediaType === "video") && (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded bg-black/55">
                      <Play className="size-3 fill-white text-white" />
                    </span>
                  )}
                </button>
              </div>
            ))}
            {hasMore ? (
              <div ref={sentinelRef} className="h-px w-full shrink-0 basis-full" aria-hidden />
            ) : null}
          </div>
        )}

        {!postsLoading && posts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-white/45">
            <Camera className="size-10 text-white/25" />
            <p className="text-sm font-medium">No posts yet</p>
            <p className="text-xs text-white/30">Share your first moment</p>
          </div>
        ) : null}

        {postsLoadingMore ? (
          <p className="mt-3 text-center text-xs text-white/40">Loading more…</p>
        ) : null}
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="presentation">
          <button type="button" className="absolute inset-0" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="relative flex h-full w-[min(100%,320px)] flex-col bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-bold">Settings & activity</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 border-b border-white/10 p-4">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt={`${displayName} profile photo`}
                  className="size-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-full bg-pink-500/20 text-lg font-bold text-pink-400">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold">{displayName}</div>
                <div className="truncate text-sm text-white/45">@{username}</div>
              </div>
            </div>
            <nav className="flex flex-col gap-4 overflow-y-auto p-3 text-sm">
              <div>
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                  Creator tools
                </p>
                <div className="flex flex-col gap-0.5">
                  <SettingsDrawerRow
                    icon={Zap}
                    label="Creator Dashboard"
                    sublabel="Stats, earnings, and tools"
                    accent="text-amber-400"
                    href="/dashboard"
                    onClose={() => setMenuOpen(false)}
                  />
                  <SettingsDrawerRow
                    icon={BarChart2}
                    label="Professional Dashboard"
                    sublabel="Wallet, promotions, insights"
                    accent="text-sky-400"
                    href="/dashboard/promotions"
                    onClose={() => setMenuOpen(false)}
                  />
                  <SettingsDrawerRow
                    icon={BadgeCheck}
                    label="Get Verification Badge"
                    sublabel="Confirm email in the Bromo app"
                    accent="text-pink-400"
                    href="/dashboard/profile"
                    onClose={() => setMenuOpen(false)}
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-white/35">Settings</p>
                <div className="flex flex-col gap-0.5">
                  <SettingsDrawerRow
                    icon={Bell}
                    label="Notification settings"
                    accent="text-white/80"
                    href="/dashboard/notifications"
                    onClose={() => setMenuOpen(false)}
                  />
                  <SettingsDrawerRow
                    icon={Shield}
                    label="Account privacy"
                    sublabel="Public or private — profile editor"
                    accent="text-white/80"
                    href="/dashboard/profile"
                    onClose={() => setMenuOpen(false)}
                  />
                  <SettingsDrawerRow
                    icon={Sliders}
                    label="Content preferences"
                    accent="text-white/80"
                    href="/dashboard/content"
                    onClose={() => setMenuOpen(false)}
                  />
                  <SettingsDrawerRow
                    icon={Film}
                    label="Media quality"
                    sublabel="Upload & playback — content library"
                    accent="text-white/80"
                    href="/dashboard/content"
                    onClose={() => setMenuOpen(false)}
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-white/35">Account</p>
                <div className="flex flex-col gap-0.5">
                  <SettingsDrawerRow
                    icon={Activity}
                    label="Your activity"
                    sublabel="Overview & content performance"
                    accent="text-white/80"
                    href="/dashboard"
                    onClose={() => setMenuOpen(false)}
                  />
                  <SettingsDrawerRow
                    icon={Smartphone}
                    label="Devices and sessions"
                    sublabel="Secured via your Bromo login"
                    accent="text-white/80"
                    href="/dashboard/profile"
                    onClose={() => setMenuOpen(false)}
                  />
                  <SettingsDrawerRow
                    icon={KeyRound}
                    label="Permissions"
                    sublabel="Camera, location — manage in the app"
                    accent="text-white/80"
                    href="/dashboard/profile"
                    onClose={() => setMenuOpen(false)}
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-white/35">More info</p>
                <SettingsDrawerRow
                  icon={Info}
                  label={`About ${site.name}`}
                  sublabel="Marketing site & support"
                  accent="text-white/80"
                  href="https://bromo.app"
                  onClose={() => setMenuOpen(false)}
                />
              </div>
              <div className="border-t border-white/10 pt-2">
                <SettingsDrawerRow
                  icon={UserPlus}
                  label="Add another account"
                  sublabel="You will be logged out of this portal session"
                  accent="text-sky-400"
                  onClose={() => setMenuOpen(false)}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.confirm("Log out to use another account?")) {
                      void logout();
                    }
                  }}
                />
                <SettingsDrawerRow
                  icon={PenSquare}
                  label="Edit profile"
                  accent="text-white/80"
                  onClose={() => setMenuOpen(false)}
                  onClick={openEdit}
                />
                <SettingsDrawerRow
                  icon={ShoppingBag}
                  label="Store"
                  accent="text-white/80"
                  href="/dashboard/store"
                  onClose={() => setMenuOpen(false)}
                />
                <SettingsDrawerRow
                  icon={Clapperboard}
                  label="Content library"
                  accent="text-white/80"
                  href="/dashboard/content"
                  onClose={() => setMenuOpen(false)}
                />
                <button
                  type="button"
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-rose-400 transition hover:bg-rose-500/10"
                  onClick={() => void logout()}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15">
                    <LogOut className="size-[18px]" strokeWidth={2} />
                  </div>
                  <span className="text-[13px] font-semibold">Log out</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      <ContentViewerModal
        post={viewerPost}
        currentUserId={user._id}
        onClose={() => setViewerPost(null)}
      />
    </div>
  );

  return (
    <div className="flex w-full flex-col items-stretch gap-8 lg:flex-row lg:justify-center lg:gap-10 lg:items-start">
      {phone}
      {editOpen ? (
        <section
          id="edit-profile-panel"
          className="mx-auto w-full max-w-[460px] rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:mx-0 lg:shrink-0"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">Edit profile</h2>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              Done
            </button>
          </div>
          <p className="text-xs text-white/35">
            Display name, bio, website, and phone stay in sync with your Bromo account.
          </p>
          <div className="mt-5">{editForm}</div>
        </section>
      ) : null}
    </div>
  );
}
