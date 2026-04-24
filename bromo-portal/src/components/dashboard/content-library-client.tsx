"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Clapperboard, FileImage, Film, LayoutGrid, Layers, Play, Plus, Square, Trash2 } from "lucide-react";
import { ContentCreationModal } from "@/components/dashboard/content-creation-modal";
import { ContentViewerModal } from "@/components/dashboard/content-viewer-modal";
import { DraftCaptionEditor } from "@/components/dashboard/draft-caption-editor";
import { GridMediaPreview } from "@/components/dashboard/grid-media-preview";
import { useContentLibraryFeed } from "@/hooks/use-content-library-feed";
import { publicMediaUrl } from "@/lib/media-url";
import type { PortalPost, UserPostsApiResponse } from "@/types/post";

type Tab = "all" | "post" | "reel" | "drafts" | "trash";
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
  const [trash, setTrash] = useState<PortalPost[]>([]);
  const [trashPage, setTrashPage] = useState(1);
  const [trashHasMore, setTrashHasMore] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"post" | "reel" | "story">("post");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

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

  const loadTrash = useCallback(
    async (pageNum: number, append: boolean) => {
      setTrashLoading(true);
      try {
        const q = new URLSearchParams({ userId, page: String(pageNum) });
        const res = await fetch(`/api/portal/user-trash?${q}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as UserPostsApiResponse;
        if (!res.ok) return;
        const batch = data.posts ?? [];
        setTrash((prev) => (append ? [...prev, ...batch] : batch));
        setTrashHasMore(Boolean(data.hasMore));
        setTrashPage(pageNum);
      } finally {
        setTrashLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (tab === "trash") void loadTrash(1, false);
  }, [tab, loadTrash]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [tab]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const callPostAction = useCallback(async (postId: string, action: "trash" | "restore" | "permanent") => {
    if (action === "trash") {
      await fetch(`/api/portal/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
      return;
    }
    if (action === "restore") {
      await fetch(`/api/portal/posts/${encodeURIComponent(postId)}/restore`, { method: "POST" });
      return;
    }
    await fetch(`/api/portal/posts/${encodeURIComponent(postId)}/permanent`, { method: "DELETE" });
  }, []);

  const runBulk = async (action: "trash" | "restore" | "permanent") => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    await Promise.all([...selectedIds].map((id) => callPostAction(id, action)));
    setSelectedIds(new Set());
    setBulkBusy(false);
    if (tab === "trash") {
      void loadTrash(1, false);
    }
  };

  const postNow = async (payload: {
    type: "story" | "post" | "reel";
    file: File;
    caption: string;
    tagsCsv: string;
    location: string;
    feedCategory: string;
    audioSource: "original" | "mute" | "bromo";
    audioTrack: string;
    filterPreset: string;
    trimStartMs: number;
    trimEndMs: number;
    speed: number;
    brightness: number;
    contrast: number;
    saturation: number;
    blur: number;
    crop: string;
    visibility: "public" | "close_friends";
    commentsOff: boolean;
    hideLikes: boolean;
    pollQuestion: string;
    pollOptionsCsv: string;
    tagPeopleCsv: string;
    tagProductsCsv: string;
  }) => {
    const form = new FormData();
    form.set("file", payload.file);
    form.set("category", payload.type === "reel" ? "reels" : payload.type === "story" ? "stories" : "posts");
    form.set("caption", payload.caption.trim());
    form.set("tags", payload.tagsCsv.trim());
    form.set("location", payload.location.trim());
    const taggedUserIds = payload.tagPeopleCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
    const productIds = payload.tagProductsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
    if (taggedUserIds) form.set("taggedUserIds", taggedUserIds);
    if (productIds) form.set("productIds", productIds);
    form.set(
      "settings",
      JSON.stringify({
        commentsOff: payload.commentsOff,
        hideLikes: payload.hideLikes,
        closeFriendsOnly: payload.visibility === "close_friends",
        allowRemix: true,
      }),
    );
    form.set("feedCategory", payload.feedCategory);
    form.set(
      "clientEditMeta",
      JSON.stringify({
        crop: payload.crop,
        adjust: {
          brightness: payload.brightness,
          contrast: payload.contrast,
          saturation: payload.saturation,
          blur: payload.blur,
        },
        filterPreset: payload.filterPreset,
        trim: { startMs: payload.trimStartMs, endMs: payload.trimEndMs },
        speed: payload.speed,
        audio: {
          source: payload.audioSource,
          track: payload.audioTrack || undefined,
        },
        poll:
          payload.pollQuestion.trim() && payload.pollOptionsCsv.trim()
            ? {
                question: payload.pollQuestion.trim(),
                options: payload.pollOptionsCsv
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : undefined,
      }),
    );
    const res = await fetch("/api/portal/media/upload-async", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { message?: string; jobId?: string };
    if (!res.ok) throw new Error(data.message ?? "Upload failed");
    setUploadStatus(data.jobId ? `Processing job ${data.jobId}...` : "Processing...");
    setTimeout(() => setUploadStatus(null), 7000);
  };

  const saveDraft = async (payload: {
    type: "story" | "post" | "reel";
    file: File;
    caption: string;
    tagsCsv: string;
    location: string;
    feedCategory: string;
    audioTrack: string;
    trimStartMs: number;
    trimEndMs: number;
    commentsOff: boolean;
    hideLikes: boolean;
    tagPeopleCsv: string;
    tagProductsCsv: string;
  }) => {
    const body = {
      type: payload.type,
      localUri: payload.file.name,
      thumbnailUri: "",
      mediaType: payload.file.type.startsWith("video/") ? "video" : "image",
      caption: payload.caption,
      location: payload.location,
      tags: payload.tagsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      taggedUserIds: payload.tagPeopleCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      productIds: payload.tagProductsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      music: payload.audioTrack,
      feedCategory: payload.feedCategory,
      trim: { startMs: payload.trimStartMs, endMs: payload.trimEndMs },
      settings: {
        commentsOff: payload.commentsOff,
        hideLikes: payload.hideLikes,
        allowRemix: true,
      },
    };
    const res = await fetch("/api/portal/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(data.message ?? "Failed to save draft");
    setUploadStatus("Draft saved.");
    setTimeout(() => setUploadStatus(null), 4000);
    if (tab === "drafts") void loadDrafts();
  };

  const draftList =
    sort === "oldest" || sort === "latest" ? sortDrafts(drafts, sort) : sortDrafts(drafts, "latest");

  return (
    <div className="space-y-6">
      <ContentViewerModal post={viewerPost} currentUserId={userId} onClose={() => setViewerPost(null)} />
      <ContentCreationModal
        open={createOpen}
        initialType={createType}
        onClose={() => setCreateOpen(false)}
        onPostNow={postNow}
        onSaveDraft={saveDraft}
      />

      {searchHint?.trim() ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[var(--foreground-muted)]">
          Search from the top bar: <span className="font-medium text-[var(--foreground)]">&quot;{searchHint.trim()}&quot;</span>
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
              { id: "trash" as const, label: "Trash", Icon: Trash2 },
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
        {tab !== "drafts" && tab !== "trash" ? (
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
            {tab === "drafts" ? "Drafts: metadata + caption staging." : "Trash: restore or permanently delete."}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateType("post");
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-foreground)]"
          >
            <Plus className="size-4" />
            Create from web
          </button>
          <button
            type="button"
            onClick={() => setSelectionMode((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--hairline)] px-3 py-2 text-sm"
          >
            {selectionMode ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
            Bulk actions
          </button>
          <button type="button" onClick={() => { setCreateType("story"); setCreateOpen(true); }} className="rounded-xl border border-[var(--hairline)] px-3 py-2 text-sm">Story</button>
          <button type="button" onClick={() => { setCreateType("post"); setCreateOpen(true); }} className="rounded-xl border border-[var(--hairline)] px-3 py-2 text-sm">Post</button>
          <button type="button" onClick={() => { setCreateType("reel"); setCreateOpen(true); }} className="rounded-xl border border-[var(--hairline)] px-3 py-2 text-sm">Reel</button>
          <button type="button" onClick={() => window.alert("Live workflow needs streaming backend wiring next.")} className="rounded-xl border border-[var(--hairline)] px-3 py-2 text-sm">Go live</button>
        </div>
        {uploadStatus ? <p className="mt-2 text-xs text-emerald-300">{uploadStatus}</p> : null}
      </div>

      {selectionMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm">
          <span className="text-[var(--foreground-muted)]">{selectedIds.size} selected</span>
          {tab !== "trash" ? (
            <button type="button" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk("trash")} className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-rose-200 disabled:opacity-50">
              Move to trash
            </button>
          ) : (
            <>
              <button type="button" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk("restore")} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-emerald-200 disabled:opacity-50">
                Restore
              </button>
              <button type="button" disabled={bulkBusy || selectedIds.size === 0} onClick={() => void runBulk("permanent")} className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-rose-200 disabled:opacity-50">
                Delete permanently
              </button>
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</p> : null}
      {tab === "drafts" && draftLoading && drafts.length === 0 ? <p className="text-sm text-[var(--foreground-muted)]">Loading…</p> : null}
      {tab !== "drafts" && tab !== "trash" && loading && posts.length === 0 ? <p className="text-sm text-[var(--foreground-muted)]">Loading…</p> : null}
      {tab === "trash" && trashLoading && trash.length === 0 ? <p className="text-sm text-[var(--foreground-muted)]">Loading trash…</p> : null}

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
      ) : tab === "trash" ? (
        <ul className="grid grid-cols-3 gap-1 lg:grid-cols-6">
          {trash.map((p) => (
            <li key={p._id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => (selectionMode ? toggleSelected(p._id) : setViewerPost(p))}
                className="group relative block aspect-square overflow-hidden rounded-lg border border-[var(--hairline)] bg-black text-left"
              >
                <GridMediaPreview post={p} alt={itemAlt(p)} className="size-full object-cover opacity-80 transition group-hover:opacity-95" />
                {selectionMode ? (
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">
                    {selectedIds.has(p._id) ? "Selected" : "Select"}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-3 gap-1 lg:grid-cols-6">
          {posts.map((p) => (
            <li key={p._id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => (selectionMode ? toggleSelected(p._id) : setViewerPost(p))}
                className="group relative block aspect-square overflow-hidden rounded-lg border border-[var(--hairline)] bg-black text-left"
              >
                <GridMediaPreview post={p} alt={itemAlt(p)} className="size-full object-cover transition group-hover:opacity-95" />
                {selectionMode ? (
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">
                    {selectedIds.has(p._id) ? "Selected" : "Select"}
                  </span>
                ) : null}
                {(p.type === "reel" || p.mediaType === "video") ? (
                  <span className="pointer-events-none absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/65">
                    <Play className="size-3 fill-white text-white" />
                  </span>
                ) : null}
              </button>
              <p className="line-clamp-2 text-[10px] leading-tight text-[var(--foreground-muted)]">
                {p.caption?.trim() || p.type}
              </p>
            </li>
          ))}
        </ul>
      )}

      {tab !== "drafts" && tab !== "trash" && hasMore ? <div ref={sentinelRef} className="h-3 w-full shrink-0" aria-hidden /> : null}
      {tab === "trash" && trashHasMore && !trashLoading ? (
        <button type="button" onClick={() => void loadTrash(trashPage + 1, true)} className="w-full rounded-2xl border border-[var(--hairline)] py-3 text-sm">
          Load more trash
        </button>
      ) : null}

      {tab === "drafts" && !draftLoading && drafts.length === 0 ? <p className="text-sm text-[var(--foreground-muted)]">No drafts yet.</p> : null}
      {tab !== "drafts" && tab !== "trash" && !loading && posts.length === 0 ? <p className="text-sm text-[var(--foreground-muted)]">Nothing in this filter yet.</p> : null}
      {tab === "trash" && !trashLoading && trash.length === 0 ? <p className="text-sm text-[var(--foreground-muted)]">Trash is empty.</p> : null}
      {loadingMore && tab !== "drafts" && tab !== "trash" ? <p className="text-center text-xs text-[var(--foreground-muted)]">Loading more…</p> : null}
    </div>
  );
}
