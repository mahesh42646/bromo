"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Clapperboard, FileImage, Film, LayoutGrid, Layers, Play } from "lucide-react";
import { DraftCaptionEditor } from "@/components/dashboard/draft-caption-editor";
import { publicMediaUrl } from "@/lib/media-url";
import type { PortalPost, UserPostsApiResponse } from "@/types/post";

type Tab = "all" | "post" | "reel" | "drafts";
type Sort = "latest" | "oldest" | "views" | "likes";

type DraftRow = {
  _id: string;
  caption?: string;
  type?: string;
  mediaType?: string;
  thumbnailUri?: string;
  updatedAt?: string;
};

function postThumbUrl(p: PortalPost): string {
  const t = p.thumbnailUrl?.trim();
  if (p.mediaType === "video" && t) return publicMediaUrl(t) ?? "";
  if (t) return publicMediaUrl(t) ?? "";
  return publicMediaUrl(p.mediaUrl) ?? "";
}

function GridThumb({ post, label }: { post: PortalPost; label: string }) {
  const [failed, setFailed] = useState(false);
  const u = postThumbUrl(post);
  const video = post.mediaType === "video";
  const rawPlay = publicMediaUrl(post.hlsMasterUrl) ?? publicMediaUrl(post.mediaUrl);
  const playNonHls = rawPlay && !rawPlay.includes(".m3u8") ? rawPlay : null;

  if (video && (failed || !u) && playNonHls) {
    return (
      <video
        src={playNonHls}
        muted
        playsInline
        preload="metadata"
        className="pointer-events-none h-full w-full object-cover"
        aria-hidden
      />
    );
  }
  if (!u || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] text-[var(--foreground-subtle)]">
        <Film className="size-8 opacity-40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={u}
      alt={label}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function sortDrafts(rows: DraftRow[], sort: Sort): DraftRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (sort === "oldest") return ta - tb;
    return tb - ta;
  });
  return copy;
}

export function ContentLibraryClient({
  userId,
  searchHint,
}: {
  userId: string;
  searchHint?: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("latest");
  const [posts, setPosts] = useState<PortalPost[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/drafts", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { drafts?: DraftRow[] };
      setDrafts(Array.isArray(data.drafts) ? data.drafts : []);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPosts = useCallback(
    async (t: Tab, pageNum: number, sortKey: Sort, append: boolean) => {
      if (t === "drafts") return;
      setLoading(true);
      try {
        const type = t === "all" ? "all" : t;
        const q = new URLSearchParams({
          userId,
          type,
          page: String(pageNum),
          sort: sortKey,
        });
        const res = await fetch(`/api/portal/user-posts?${q}`, { cache: "no-store" });
        const raw = (await res.json().catch(() => ({}))) as UserPostsApiResponse;
        if (!res.ok) {
          setPosts((p) => (append ? p : []));
          setHasMore(false);
          return;
        }
        const next = raw.posts ?? [];
        setPosts((p) => (append ? [...p, ...next] : next));
        setHasMore(Boolean(raw.hasMore));
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    setPage(1);
    if (tab === "drafts") {
      void loadDrafts();
      return;
    }
    void loadPosts(tab, 1, sort, false);
  }, [tab, sort, loadDrafts, loadPosts]);

  const loadMore = () => {
    if (tab === "drafts" || !hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    void loadPosts(tab, next, sort, true);
  };

  const draftList = sort === "oldest" || sort === "latest" ? sortDrafts(drafts, sort) : sortDrafts(drafts, "latest");

  return (
    <div className="space-y-6">
      {searchHint?.trim() ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[var(--foreground-muted)]">
          Search from the top bar:{" "}
          <span className="font-medium text-[var(--foreground)]">&quot;{searchHint.trim()}&quot;</span> — match items
          below in this library.
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-1">
          {(
            [
              { id: "all" as const, label: "All", Icon: Layers },
              { id: "post" as const, label: "Posts", Icon: LayoutGrid },
              { id: "reel" as const, label: "Reels", Icon: Clapperboard },
              { id: "drafts" as const, label: "Drafts", Icon: FileImage },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                tab === id
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-md"
                  : "text-[var(--foreground-muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="size-4 opacity-80" />
              {label}
            </button>
          ))}
        </div>

        {tab !== "drafts" ? (
          <label className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
            <span className="whitespace-nowrap">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="views">Most views</option>
              <option value="likes">Most likes</option>
            </select>
          </label>
        ) : (
          <p className="text-xs text-[var(--foreground-subtle)]">
            Drafts are ordered by last update. Capture and upload from the Bromo app; polish captions here.
          </p>
        )}
      </div>

      {loading && (tab === "drafts" ? drafts.length === 0 : posts.length === 0) ? (
        <p className="text-sm text-[var(--foreground-muted)]">Loading…</p>
      ) : null}

      {tab === "drafts" ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {draftList.map((d) => {
            const thumb = publicMediaUrl(d.thumbnailUri);
            return (
              <li
                key={d._id}
                className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--card)]"
              >
                <div className="relative aspect-video bg-[var(--surface)]">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[var(--foreground-subtle)]">
                      <Film className="size-10 opacity-30" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {d.type ?? "draft"}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="text-xs text-[var(--foreground-muted)]">
                    {d.mediaType ?? "media"} ·{" "}
                    {d.updatedAt ? new Date(d.updatedAt).toLocaleString() : "—"}
                  </div>
                  <DraftCaptionEditor draftId={d._id} caption={d.caption ?? ""} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((p) => (
            <li
              key={p._id}
              className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--card)]"
            >
              <Link href={`/dashboard/promotions?contentId=${encodeURIComponent(p._id)}`} className="block">
                <div className="relative aspect-video bg-black">
                  <GridThumb
                    post={p}
                    label={p.caption?.trim() ? p.caption.trim().slice(0, 80) : `${p.type} thumbnail`}
                  />
                  {(p.type === "reel" || p.mediaType === "video") && (
                    <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60">
                      <Play className="size-3.5 fill-white text-white" />
                    </span>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {p.type}
                  </span>
                </div>
              </Link>
              <div className="space-y-2 p-4 text-sm">
                <p className="line-clamp-2 text-[var(--foreground)]">{p.caption?.trim() || "No caption"}</p>
                <div className="flex flex-wrap gap-3 text-xs text-[var(--foreground-muted)]">
                  <span>{p.viewsCount != null ? `${p.viewsCount} views` : "— views"}</span>
                  <span>{p.likesCount != null ? `${p.likesCount} likes` : "— likes"}</span>
                  {p.createdAt ? (
                    <time dateTime={p.createdAt}>{new Date(p.createdAt).toLocaleDateString()}</time>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/dashboard/promotions?contentId=${encodeURIComponent(p._id)}&contentType=${p.type === "reel" ? "reel" : "post"}`}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    Promote
                  </Link>
                  <span className="text-[var(--foreground-subtle)]">·</span>
                  <span className="text-xs text-[var(--foreground-subtle)]">Open in app for full editor</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "drafts" && !loading && drafts.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">No drafts yet. Start from the Bromo app.</p>
      ) : null}
      {tab !== "drafts" && !loading && posts.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">Nothing in this filter yet.</p>
      ) : null}

      {hasMore && tab !== "drafts" ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full rounded-2xl border border-[var(--hairline)] py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
