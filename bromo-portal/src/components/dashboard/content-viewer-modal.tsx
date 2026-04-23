"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Heart,
  Loader2,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { HlsVideo } from "@/components/dashboard/hls-video";
import { publicMediaUrl } from "@/lib/media-url";
import type {
  PortalCommentNode,
  PortalPost,
  PortalPostDetail,
  PostCommentsApiResponse,
} from "@/types/post";

function formatRelative(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 52) return `${w}w`;
  return new Date(iso).toLocaleDateString();
}

function resolvePlaybackSrc(post: PortalPost): string | null {
  const hls = post.hlsMasterUrl?.trim();
  if (hls) return publicMediaUrl(hls);
  return publicMediaUrl(post.mediaUrl);
}

function previewStillSrc(post: PortalPost): string {
  const thumb = post.thumbnailUrl?.trim();
  if (post.mediaType === "video" && thumb) return publicMediaUrl(thumb) ?? "";
  if (thumb) return publicMediaUrl(thumb) ?? "";
  return publicMediaUrl(post.mediaUrl) ?? "";
}

type AnalyticsPayload = {
  viewsCount?: number;
  impressionsCount?: number;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  reachRate?: number;
  engagementRate?: number;
};

export function ContentViewerModal({
  post,
  currentUserId,
  onClose,
}: {
  post: PortalPost | null;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<PortalPostDetail | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [comments, setComments] = useState<PortalCommentNode[]>([]);
  const [cPage, setCPage] = useState(1);
  const [cHasMore, setCHasMore] = useState(false);
  const [cLoading, setCLoading] = useState(false);
  const [text, setText] = useState("");
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyHint, setReplyHint] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [videoMuted, setVideoMuted] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insights, setInsights] = useState<AnalyticsPayload | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsErr, setInsightsErr] = useState<string | null>(null);

  const postId = post?._id ?? null;

  useEffect(() => {
    if (!postId) {
      setDetail(null);
      setDetailErr(null);
      return;
    }
    let cancelled = false;
    setDetailErr(null);
    void (async () => {
      try {
        const res = await fetch(`/api/portal/posts/${encodeURIComponent(postId)}`, { cache: "no-store" });
        const raw = (await res.json().catch(() => ({}))) as { post?: PortalPostDetail; message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setDetailErr(raw.message ?? "Could not load post");
          setDetail(post as PortalPostDetail);
          return;
        }
        setDetail(raw.post ? { ...post, ...raw.post } : (post as PortalPostDetail));
      } catch {
        if (!cancelled) {
          setDetailErr("Could not load post");
          setDetail(post as PortalPostDetail);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [post, postId]);

  const loadComments = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!postId) return;
      setCLoading(true);
      try {
        const q = new URLSearchParams({ page: String(pageNum) });
        const res = await fetch(`/api/portal/posts/${encodeURIComponent(postId)}/comments?${q}`, {
          cache: "no-store",
        });
        const raw = (await res.json().catch(() => ({}))) as PostCommentsApiResponse & { message?: string };
        if (!res.ok) return;
        const batch = raw.comments ?? [];
        setComments((prev) => (append ? [...prev, ...batch] : batch));
        setCPage(pageNum);
        setCHasMore(Boolean(raw.hasMore));
      } finally {
        setCLoading(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    if (!postId) {
      setComments([]);
      setCPage(1);
      setCHasMore(false);
      return;
    }
    setText("");
    setReplyParentId(null);
    setReplyHint(null);
    setInsightsOpen(false);
    setInsights(null);
    void loadComments(1, false);
  }, [postId, loadComments]);

  useEffect(() => {
    if (!insightsOpen || !postId) return;
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsErr(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/portal/post-analytics?postId=${encodeURIComponent(postId)}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => ({}))) as AnalyticsPayload & { message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setInsightsErr(data.message ?? "Could not load insights");
          setInsights(null);
          return;
        }
        setInsights(data);
      } catch {
        if (!cancelled) setInsightsErr("Could not load insights");
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [insightsOpen, postId]);

  const author = detail?.author;
  const authorName = author?.username || author?.displayName || "Creator";
  const authorPic = publicMediaUrl(author?.profilePicture);
  const postAuthorId = author?._id ? String(author._id) : "";

  const canModerateComment = useCallback(
    (c: PortalCommentNode) => {
      const aid = c.author?._id != null ? String(c.author._id) : "";
      if (aid && aid === currentUserId) return true;
      if (postAuthorId && postAuthorId === currentUserId) return true;
      return false;
    },
    [currentUserId, postAuthorId],
  );

  const submitComment = async () => {
    if (!postId || !text.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/portal/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          ...(replyParentId ? { parentId: replyParentId } : {}),
        }),
      });
      await res.json().catch(() => null);
      if (!res.ok) return;
      void loadComments(1, false);
      setText("");
      setReplyParentId(null);
      setReplyHint(null);
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!postId || deletingId) return;
    setDeletingId(commentId);
    try {
      const res = await fetch(
        `/api/portal/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) return;
      setComments((prev) =>
        prev
          .map((root) => {
            if (String(root._id) === commentId) return null;
            const replies = (root.replies ?? []).filter((r) => String(r._id) !== commentId);
            if (replies.length !== (root.replies ?? []).length) {
              return { ...root, replies, repliesCount: Math.max(0, (root.repliesCount ?? 1) - 1) };
            }
            return root;
          })
          .filter(Boolean) as PortalCommentNode[],
      );
    } finally {
      setDeletingId(null);
    }
  };

  const boost = () => {
    if (!post) return;
    const ct = post.type === "reel" ? "reel" : "post";
    onClose();
    router.push(`/dashboard/promotions?contentId=${encodeURIComponent(post._id)}&contentType=${ct}`);
  };

  const merged = useMemo((): PortalPostDetail | null => {
    if (!post) return null;
    return detail ? { ...post, ...detail } : (post as PortalPostDetail);
  }, [post, detail]);

  if (!post || !merged) return null;

  const playback = merged.mediaType === "video" ? resolvePlaybackSrc(merged) : null;
  const still = previewStillSrc(merged);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="content-viewer-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl lg:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-20 rounded-full bg-black/70 p-2 text-white hover:bg-black/90 lg:right-3 lg:top-3"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <div className="relative flex min-h-[42vh] flex-1 items-center justify-center bg-black lg:min-h-0 lg:max-w-[min(420px,44vw)]">
          {merged?.mediaType === "video" && playback ? (
            <div className="relative aspect-[9/16] w-full max-h-[min(78vh,720px)]">
              <HlsVideo src={playback} className="size-full object-contain" muted={videoMuted} />
              <button
                type="button"
                onClick={() => setVideoMuted((m) => !m)}
                className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white"
              >
                {videoMuted ? "Unmute" : "Mute"}
              </button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={still} alt="" className="max-h-[min(78vh,720px)] w-full object-contain" />
          )}
          {merged?.caption?.trim() ? (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12 text-sm text-white/95">
              {merged.caption.trim()}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 lg:max-w-md lg:border-l lg:border-t-0">
          <div className="flex items-start gap-3 border-b border-white/10 p-4 pr-12">
            {authorPic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={authorPic} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/80">
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 id="content-viewer-title" className="truncate text-sm font-bold text-white">
                @{authorName}
              </h2>
              <p className="truncate text-xs text-white/45">
                {merged?.type === "reel" ? "Reel" : merged?.type === "post" ? "Post" : merged?.type ?? "Content"}
                {detailErr ? ` · ${detailErr}` : ""}
              </p>
            </div>
            <button type="button" className="rounded-lg p-2 text-white/50 hover:bg-white/10" aria-label="More">
              <MoreHorizontal className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {merged?.caption?.trim() ? (
              <p className="text-sm text-white/90">
                <span className="font-semibold text-white">@{authorName}</span>{" "}
                <span className="text-white/85">{merged.caption.trim()}</span>
                <span className="ml-2 text-xs text-white/35">{formatRelative(merged.createdAt)}</span>
              </p>
            ) : null}

            {comments.map((c) => (
              <div key={c._id} className="space-y-2 border-b border-white/[0.06] pb-3 last:border-0">
                <CommentRow
                  node={c}
                  canDelete={canModerateComment(c)}
                  deleting={deletingId === c._id}
                  onReply={() => {
                    setReplyParentId(c._id);
                    setReplyHint(c.author?.username ?? "comment");
                  }}
                  onDelete={() => void deleteComment(c._id)}
                />
                {(c.replies ?? []).map((r) => (
                  <div key={r._id} className="ml-6 border-l border-white/10 pl-3">
                    <CommentRow
                      node={r}
                      canDelete={canModerateComment(r)}
                      deleting={deletingId === r._id}
                      onReply={() => {
                        setReplyParentId(r._id);
                        setReplyHint(r.author?.username ?? "reply");
                      }}
                      onDelete={() => void deleteComment(r._id)}
                    />
                  </div>
                ))}
              </div>
            ))}
            {cLoading && comments.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-white/45">
                <Loader2 className="size-4 animate-spin" /> Loading comments…
              </p>
            ) : null}
            {cHasMore ? (
              <button
                type="button"
                disabled={cLoading}
                onClick={() => void loadComments(cPage + 1, true)}
                className="text-sm font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50"
              >
                {cLoading ? "Loading…" : "Load more comments"}
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-2">
            <button
              type="button"
              onClick={() => setInsightsOpen((o) => !o)}
              className="text-sm font-semibold text-sky-400 hover:text-sky-300"
            >
              View insights
            </button>
            <button
              type="button"
              onClick={boost}
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-violet-500"
            >
              <Megaphone className="size-4" />
              Boost
            </button>
          </div>

          {insightsOpen ? (
            <div className="border-t border-white/10 px-4 py-3">
              {insightsLoading ? (
                <p className="text-xs text-white/45">Loading insights…</p>
              ) : insightsErr ? (
                <p className="text-xs text-rose-400">{insightsErr}</p>
              ) : insights ? (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <Metric k="Views" v={insights.viewsCount ?? 0} />
                  <Metric k="Impressions" v={insights.impressionsCount ?? 0} />
                  <Metric k="Likes" v={insights.likesCount ?? 0} />
                  <Metric k="Comments" v={insights.commentsCount ?? 0} />
                  <Metric k="Reach %" v={insights.reachRate ?? 0} />
                  <Metric k="Engagement %" v={insights.engagementRate ?? 0} />
                </dl>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-white/55">
            <Heart className="size-5" />
            <span className="text-xs">{merged?.likesCount ?? 0} likes</span>
            <MessageCircle className="size-5" />
            <span className="text-xs">{merged?.commentsCount ?? comments.length}</span>
            <span className="ml-auto text-xs text-white/40">
              {merged?.createdAt ? new Date(merged.createdAt).toLocaleDateString() : ""}
            </span>
          </div>

          <div className="border-t border-white/10 p-3">
            {replyHint ? (
              <p className="mb-2 text-xs text-white/50">
                Replying to @{replyHint}
                <button
                  type="button"
                  className="ml-2 text-sky-400 hover:underline"
                  onClick={() => {
                    setReplyParentId(null);
                    setReplyHint(null);
                  }}
                >
                  Cancel
                </button>
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-violet-500/40"
              />
              <button
                type="button"
                disabled={posting || !text.trim()}
                onClick={() => void submitComment()}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
              >
                {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-white/40">{k}</dt>
      <dd className="font-semibold tabular-nums text-white">{v}</dd>
    </div>
  );
}

function CommentRow({
  node,
  canDelete,
  deleting,
  onReply,
  onDelete,
}: {
  node: PortalCommentNode;
  canDelete: boolean;
  deleting: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  const u = node.author?.username ?? node.author?.displayName ?? "user";
  const pic = publicMediaUrl(node.author?.profilePicture);
  return (
    <div className="flex gap-2">
      {pic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pic} alt="" className="mt-0.5 size-8 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/70">
          {u.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/90">
          <span className="font-semibold">@{u}</span>{" "}
          <span className="text-white/80">{node.text ?? ""}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
          <span>{formatRelative(node.createdAt)}</span>
          <button type="button" onClick={onReply} className="font-semibold text-white/60 hover:text-white">
            Reply
          </button>
          {canDelete ? (
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className="inline-flex items-center gap-1 font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-40"
            >
              <Trash2 className="size-3" />
              {deleting ? "…" : "Delete"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
