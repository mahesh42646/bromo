"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPortalUserPostsPage } from "@/lib/portal-user-posts-client";
import type { PortalPost } from "@/types/post";

const PREFETCH_ENABLED = true;

type LibTab = "all" | "post" | "reel" | "drafts";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPageWithBackoff(args: {
  userId: string;
  type: string;
  sort: string;
  page: number;
  signal: AbortSignal;
}): Promise<ReturnType<typeof fetchPortalUserPostsPage>> {
  let delay = 400;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetchPortalUserPostsPage({
      userId: args.userId,
      type: args.type,
      sort: args.sort,
      page: args.page,
      signal: args.signal,
    });
    if (res.ok) return res;
    if (args.signal.aborted) return res;
    if (res.status === 499) return res;
    if (res.status === 429 || res.status === 503) {
      const wait = res.retryAfterMs ?? delay;
      await sleep(wait);
      delay = Math.min(delay * 2, 10_000);
      continue;
    }
    return res;
  }
  return { ok: false, status: 0, message: "too_many_retries" };
}

export function useContentLibraryFeed(userId: string, tab: LibTab, sort: string) {
  const apiType = useMemo(() => (tab === "all" ? "all" : tab), [tab]);
  const enabled = tab !== "drafts";

  const [items, setItems] = useState<PortalPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const prefetchRef = useRef<{ page: number; posts: PortalPost[]; hasMore: boolean } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const resetKey = `${tab}|${sort}`;

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setPage(1);
      setHasMore(false);
      setLoading(false);
      setError(null);
      prefetchRef.current = null;
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    setItems([]);
    setPage(1);
    setHasMore(false);
    prefetchRef.current = null;

    void (async () => {
      const res = await fetchPageWithBackoff({
        userId,
        type: apiType,
        sort,
        page: 1,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setError(res.message ?? "Could not load");
        setItems([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      setItems(res.data.posts ?? []);
      setHasMore(Boolean(res.data.hasMore));
      setLoading(false);
    })();

    return () => ac.abort();
  }, [apiType, enabled, resetKey, sort, userId]);

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || loading || loadingMore) return;
    const nextPage = page + 1;
    const pref = prefetchRef.current;
    if (pref && pref.page === nextPage) {
      setLoadingMore(true);
      setError(null);
      setItems((prev) => [...prev, ...pref.posts]);
      setPage(nextPage);
      setHasMore(pref.hasMore);
      prefetchRef.current = null;
      setLoadingMore(false);
      return;
    }

    setLoadingMore(true);
    setError(null);
    const ac = new AbortController();
    const res = await fetchPageWithBackoff({
      userId,
      type: apiType,
      sort,
      page: nextPage,
      signal: ac.signal,
    });
    if (!res.ok) {
      setError(res.message ?? "Could not load more");
      setLoadingMore(false);
      return;
    }
    const batch = res.data.posts ?? [];
    setItems((prev) => [...prev, ...batch]);
    setPage(nextPage);
    setHasMore(Boolean(res.data.hasMore));
    prefetchRef.current = null;
    setLoadingMore(false);
  }, [apiType, enabled, hasMore, loading, loadingMore, page, sort, userId]);

  useEffect(() => {
    if (!PREFETCH_ENABLED || !enabled || !hasMore || loading || loadingMore) return;
    const nextPage = page + 1;
    if (prefetchRef.current?.page === nextPage) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await fetchPageWithBackoff({
          userId,
          type: apiType,
          sort,
          page: nextPage,
          signal: ac.signal,
        });
        if (ac.signal.aborted || !res.ok) return;
        prefetchRef.current = {
          page: nextPage,
          posts: res.data.posts ?? [],
          hasMore: Boolean(res.data.hasMore),
        };
      })();
    }, 180);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [apiType, enabled, hasMore, loading, loadingMore, page, sort, userId]);

  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { root: null, rootMargin: "280px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, loadMore]);

  return {
    posts: items,
    loading: enabled && loading && items.length === 0,
    loadingMore,
    hasMore: enabled && hasMore,
    error,
    sentinelRef,
  };
}
