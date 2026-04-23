import type { UserPostsApiResponse } from "@/types/post";

export type PortalUserPostsFetchResult =
  | {
      ok: true;
      status: number;
      data: UserPostsApiResponse;
    }
  | {
      ok: false;
      status: number;
      retryAfterMs?: number;
      message?: string;
    };

function parseRetryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const asInt = parseInt(raw, 10);
  if (!Number.isNaN(asInt) && asInt > 0) return asInt * 1000;
  return undefined;
}

export async function fetchPortalUserPostsPage(args: {
  userId: string;
  type: string;
  sort?: string;
  page: number;
  signal?: AbortSignal;
}): Promise<PortalUserPostsFetchResult> {
  const { userId, type, page, signal } = args;
  const sort = args.sort ?? "latest";
  const q = new URLSearchParams({
    userId,
    type,
    page: String(page),
    sort,
  });
  try {
    const res = await fetch(`/api/portal/user-posts?${q}`, { cache: "no-store", signal });
    const retryAfterMs = parseRetryAfterMs(res);
    const raw = (await res.json().catch(() => ({}))) as UserPostsApiResponse & { message?: string };
    if (!res.ok) {
      return { ok: false, status: res.status, retryAfterMs, message: raw.message };
    }
    return {
      ok: true,
      status: res.status,
      data: {
        posts: raw.posts ?? [],
        page: raw.page ?? page,
        hasMore: Boolean(raw.hasMore),
      },
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, status: 499, message: "aborted" };
    }
    return { ok: false, status: 0, message: "network" };
  }
}
