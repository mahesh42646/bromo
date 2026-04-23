"use client";

import { useCallback, useEffect, useState } from "react";
import { Clapperboard, FileImage, Film, LayoutGrid, Layers, Play } from "lucide-react";
import { ContentViewerModal } from "@/components/dashboard/content-viewer-modal";
import { DraftCaptionEditor } from "@/components/dashboard/draft-caption-editor";
import { GridMediaPreview } from "@/components/dashboard/grid-media-preview";
import { useContentLibraryFeed } from "@/hooks/use-content-library-feed";
import { publicMediaUrl } from "@/lib/media-url";
import type { PortalPost } from "@/types/post";

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

function itemAlt(p: PortalPost): string {
  const c = p.caption?.trim();
  if (c) return c.slice(0, 72);
  return `${p.type} preview`;
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
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [viewerPost, setViewerPost] = useState<PortalPost | null>(null);

  const { posts, loading, loadingMore, hasMore, error, sentinelRef } = useContentLibraryFeed(userId, tab, sort);

  const loadDrafts = useCallback(async () => {
    setDraftLoading(true);
    try {
      const res = await fetch("/api/portal/drafts", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { drafts?: DraftRow[] };
      setDrafts(Array.isArray(data.drafts) ? data.drafts : []);
    } finally {
      setDraftLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "drafts") void loadDrafts();
  }, [tab, loadDrafts]);

  const draftList =
    sort === "oldest" || sort === "latest" ? sortDrafts(drafts, sort) : sortDrafts(drafts, "latest");

  return (
    <div className="space-y-6">
      <ContentViewerModal
        post={viewerPost}
        currentUserId={userId}
        onClose={() => setViewerPost(null)}
      />

      {searchHint?.trim() ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[var(--foreground-muted)]">
          Search from the top bar:{" "}
          <span className="font-medium text-[var(--foreground)]">&quot;{searchHint.trim()}&quot;</span>
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
            Drafts: edit captions here; capture stays in the Bromo app.
          </p>
        )}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</p>
      ) : null}

      {tab === "drafts" && draftLoading && drafts.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">Loading…</p>
      ) : null}
      {tab !== "drafts" && loading && posts.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">Loading…</p>
      ) : null}

      {tab === "drafts" ? (
        <div className="space-y-6">
          <ul className="grid grid-cols-3 gap-1 lg:grid-cols-6">
            {draftList.map((d) => {
              const thumb = publicMediaUrl(d.thumbnailUri);
              return (
                <li key={d._id} className="flex flex-col gap-1">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface)]">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[var(--foreground-subtle)]">
                        <Film className="size-8 opacity-30" />
                      </div>
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                      {d.type ?? "draft"}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[10px] leading-tight text-[var(--foreground-muted)]">
                    {d.caption?.trim() || "Draft"}
                  </p>
                </li>
              );
            })}
          </ul>
          {draftList.length > 0 ? (
            <div className="space-y-4 rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-4">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Caption edits</h3>
              <ul className="space-y-4">
                {draftList.map((d) => (
                  <li key={`edit-${d._id}`}>
                    <p className="mb-1 font-mono text-[10px] text-[var(--foreground-subtle)]">{d._id}</p>
                    <DraftCaptionEditor draftId={d._id} caption={d.caption ?? ""} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1 lg:grid-cols-6">
          {posts.map((p) => (
            <li key={p._id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setViewerPost(p)}
                className="group relative block aspect-square overflow-hidden rounded-lg border border-[var(--hairline)] bg-black text-left"
              >
                <GridMediaPreview post={p} alt={itemAlt(p)} className="size-full object-cover transition group-hover:opacity-95" />
                {(p.type === "reel" || p.mediaType === "video") && (
                  <span className="pointer-events-none absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/65">
                    <Play className="size-3 fill-white text-white" />
                  </span>
                )}
              </button>
              <p className="line-clamp-2 text-[10px] leading-tight text-[var(--foreground-muted)]">
                {p.caption?.trim() || p.type}
              </p>
            </li>
          ))}
        </ul>
      )}

      {tab !== "drafts" && hasMore ? <div ref={sentinelRef} className="h-3 w-full shrink-0" aria-hidden /> : null}

      {tab === "drafts" && !draftLoading && drafts.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">No drafts yet.</p>
      ) : null}
      {tab !== "drafts" && !loading && posts.length === 0 ? (
        <p className="text-sm text-[var(--foreground-muted)]">Nothing in this filter yet.</p>
      ) : null}

      {loadingMore && tab !== "drafts" ? (
        <p className="text-center text-xs text-[var(--foreground-muted)]">Loading more…</p>
      ) : null}
    </div>
  );
}
