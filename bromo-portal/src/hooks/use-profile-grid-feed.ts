"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPortalUserPostsPage } from "@/lib/portal-user-posts-client";
import type { PortalPost } from "@/types/post";

const TAB_DEBOUNCE_MS = 220;
const CACHE_TTL_MS = 90_000;
const MAX_TAB_CACHE_ENTRIES = 3;
const PREFETCH_ENABLED = true;

type GridTab = "posts" | "reels" | "saved";

function tabToApiType(tab: GridTab): string {
  if (tab === "reels") return "reel";
  if (tab === "saved") return "saved";
  return "post";
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

type TabSnapshot = {
  items: PortalPost[];
  page: number;
  hasMore: boolean;
  updatedAt: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPageWithBackoff(args: {
  userId: string;
  type: string;
  page: number;
  signal: AbortSignal;
}): Promise<ReturnType<typeof fetchPortalUserPostsPage>> {
  let delay = 400;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetchPortalUserPostsPage({
      userId: args.userId,
      type: args.type,
      sort: "latest",
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

export function useProfileGridFeed(userId: string, gridTab: GridTab) {
  const debouncedTab = useDebouncedValue(gridTab, TAB_DEBOUNCE_MS);
  const apiType = useMemo(() => tabToApiType(debouncedTab), [debouncedTab]);

  const [items, setItems] = useState<PortalPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, TabSnapshot>>(new Map());
  const cacheOrderRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const prefetchRef = useRef<{ page: number; posts: PortalPost[]; hasMore: boolean } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const touchCacheOrder = (key: string) => {
    const order = cacheOrderRef.current.filter((k) => k !== key);
    order.push(key);
    cacheOrderRef.current = order;
    while (order.length > MAX_TAB_CACHE_ENTRIES) {
      const evict = order.shift();
      if (evict) cacheRef.current.delete(evict);
    }
  };

  const writeCache = useCallback(
    (tab: GridTab, snap: TabSnapshot) => {
      const key = `${userId}:${tab}`;
      cacheRef.current.set(key, snap);
      touchCacheOrder(key);
    },
    [userId],
  );

  const runInitialLoad = useCallback(
    async (tab: GridTab, type: string, preferCache: boolean) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const cacheKey = `${userId}:${tab}`;
      const cached = preferCache ? cacheRef.current.get(cacheKey) : undefined;
      const now = Date.now();
      if (cached && now - cached.updatedAt < CACHE_TTL_MS) {
        setItems(cached.items);
        setPage(cached.page);
        setHasMore(cached.hasMore);
        setLoading(false);
        setError(null);
        prefetchRef.current = null;
      } else {
        setLoading(true);
        setError(null);
        setItems([]);
        setPage(1);
        setHasMore(false);
      }

      const res = await fetchPageWithBackoff({
        userId,
        type,
        page: 1,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setError(res.message ?? "Could not load posts");
        setItems([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      const next = res.data.posts ?? [];
      const hm = Boolean(res.data.hasMore);
      setItems(next);
      setPage(1);
      setHasMore(hm);
      setLoading(false);
      writeCache(tab, { items: next, page: 1, hasMore: hm, updatedAt: Date.now() });
      prefetchRef.current = null;
    },
    [userId, writeCache],
  );

  useEffect(() => {
    void runInitialLoad(debouncedTab, apiType, true);
    return () => abortRef.current?.abort();
  }, [debouncedTab, apiType, runInitialLoad]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    const nextPage = page + 1;
    const pref = prefetchRef.current;
    if (pref && pref.page === nextPage) {
      setLoadingMore(true);
      setError(null);
      const merged = [...items, ...pref.posts];
      setItems(merged);
      setPage(nextPage);
      setHasMore(pref.hasMore);
      writeCache(debouncedTab, {
        items: merged,
        page: nextPage,
        hasMore: pref.hasMore,
        updatedAt: Date.now(),
      });
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
      page: nextPage,
      signal: ac.signal,
    });
    if (!res.ok) {
      setError(res.message ?? "Could not load more");
      setLoadingMore(false);
      return;
    }
    const batch = res.data.posts ?? [];
    setItems((prev) => {
      const merged = [...prev, ...batch];
      writeCache(debouncedTab, {
        items: merged,
        page: nextPage,
        hasMore: Boolean(res.data.hasMore),
        updatedAt: Date.now(),
      });
      return merged;
    });
    setPage(nextPage);
    setHasMore(Boolean(res.data.hasMore));
    prefetchRef.current = null;
    setLoadingMore(false);
  }, [
    apiType,
    debouncedTab,
    hasMore,
    items,
    loading,
    loadingMore,
    page,
    userId,
    writeCache,
  ]);

  useEffect(() => {
    if (!PREFETCH_ENABLED || !hasMore || loading || loadingMore) return;
    const nextPage = page + 1;
    if (prefetchRef.current?.page === nextPage) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await fetchPageWithBackoff({
          userId,
          type: apiType,
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
  }, [apiType, hasMore, loading, loadingMore, page, userId]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadMore();
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const reload = useCallback(() => {
    cacheRef.current.delete(`${userId}:${debouncedTab}`);
    void runInitialLoad(debouncedTab, apiType, false);
  }, [apiType, debouncedTab, runInitialLoad, userId]);

  const postsLoading = loading && items.length === 0;

  return {
    posts: items,
    postsLoading,
    postsLoadingMore: loadingMore,
    hasMore,
    postsError: error,
    sentinelRef,
    reloadProfileGrid: reload,
  };
}
