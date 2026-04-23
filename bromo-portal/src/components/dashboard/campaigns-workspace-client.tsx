"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Megaphone, Pause, Play, Plus } from "lucide-react";
import type { PortalPost, UserPostsApiResponse } from "@/types/post";

type CampaignRow = {
  _id: string;
  status?: string;
  budgetCoins?: number;
  spentCoins?: number;
  objective?: string;
  contentType?: string;
  contentId?: string;
  createdAt?: string;
};

type CampaignDetail = CampaignRow & Record<string, unknown>;

const OBJECTIVES = [
  { value: "reach", label: "Reach — more impressions" },
  { value: "engagement", label: "Engagement" },
  { value: "followers", label: "Followers" },
  { value: "traffic", label: "Traffic to a link" },
] as const;

function contentOptionLabel(p: PortalPost): string {
  const kind = p.type === "reel" ? "Reel" : p.type === "story" ? "Story" : "Post";
  const cap = p.caption?.trim().slice(0, 56) || "No caption";
  const dt = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "";
  return `${kind}: ${cap}${dt ? ` (${dt})` : ""}`;
}

async function fetchAllPublished(userId: string): Promise<PortalPost[]> {
  const acc: PortalPost[] = [];
  for (let page = 1; page <= 8; page += 1) {
    const q = new URLSearchParams({
      userId,
      type: "all",
      page: String(page),
      sort: "latest",
    });
    const res = await fetch(`/api/portal/user-posts?${q}`, { cache: "no-store" });
    const raw = (await res.json().catch(() => ({}))) as UserPostsApiResponse;
    if (!res.ok) break;
    const batch = raw.posts ?? [];
    acc.push(...batch);
    if (!raw.hasMore) break;
  }
  acc.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  return acc;
}

export function CampaignsWorkspaceClient({
  userId,
  initialCampaigns,
  initialContentId,
  initialContentType,
}: {
  userId: string;
  initialCampaigns: CampaignRow[];
  initialContentId?: string;
  initialContentType?: string;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [picker, setPicker] = useState<PortalPost[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [pickerValue, setPickerValue] = useState("");
  const [budgetCoins, setBudgetCoins] = useState("500");
  const [objective, setObjective] = useState<string>("reach");
  const [formBusy, setFormBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPickerLoading(true);
      const rows = await fetchAllPublished(userId);
      if (!cancelled) {
        setPicker(rows);
        setPickerLoading(false);
        if (initialContentId) {
          const hit = rows.find((p) => p._id === initialContentId);
          if (hit) {
            setPickerValue(hit._id);
            setCreateOpen(true);
          } else {
            setPickerValue(initialContentId);
            setCreateOpen(true);
          }
        } else if (initialContentType && rows.length) {
          setPickerValue(rows[0]._id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, initialContentId, initialContentType]);

  const selectedPickerPost = useMemo(
    () => picker.find((p) => p._id === pickerValue) ?? null,
    [picker, pickerValue],
  );

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/portal/promotions/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { campaign?: CampaignDetail; message?: string };
      if (!res.ok) {
        setDetail(null);
        setErr(data.message ?? "Could not load campaign");
        return;
      }
      setDetail(data.campaign ?? null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId && !createOpen) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, createOpen, loadDetail]);

  const mergeCampaign = (c: CampaignRow) => {
    setCampaigns((list) => {
      const i = list.findIndex((x) => x._id === c._id);
      if (i >= 0) {
        const next = [...list];
        next[i] = { ...next[i], ...c };
        return next;
      }
      return [c, ...list];
    });
    setDetail((d) => (d && d._id === c._id ? { ...d, ...c } : d));
  };

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormBusy(true);
    setErr(null);
    setMsg(null);
    const post = selectedPickerPost;
    if (!post) {
      setErr("Pick a post or reel from the list.");
      setFormBusy(false);
      return;
    }
    const contentType = post.type === "reel" ? "reel" : post.type === "story" ? "story" : "post";
    try {
      const res = await fetch("/api/portal/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: post._id,
          contentType,
          budgetCoins: Number(budgetCoins),
          objective,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; campaign?: CampaignRow };
      if (!res.ok) {
        setErr(data.message ?? "Could not create campaign");
        return;
      }
      if (data.campaign) {
        setCampaigns((c) => [data.campaign as CampaignRow, ...c]);
        setMsg("Draft saved. Open it in the list to activate when your wallet is funded.");
        setCreateOpen(false);
        setSelectedId(String(data.campaign._id));
      }
    } finally {
      setFormBusy(false);
    }
  }

  async function postAction(path: "activate" | "pause" | "resume") {
    if (!selectedId) return;
    setActionBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/portal/promotions/${encodeURIComponent(selectedId)}/${path}`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; campaign?: CampaignRow };
      if (!res.ok) {
        setErr(data.message ?? "Action failed");
        return;
      }
      if (data.campaign) mergeCampaign(data.campaign as CampaignRow);
      setMsg(path === "activate" ? "Campaign is now active." : path === "pause" ? "Paused." : "Resumed.");
    } finally {
      setActionBusy(false);
    }
  }

  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => String(b._id).localeCompare(String(a._id))),
    [campaigns],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <aside className="space-y-4 lg:col-span-4">
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setSelectedId(null);
            setDetail(null);
            setErr(null);
            setMsg(null);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--accent-foreground)]"
        >
          <Plus className="size-4" />
          New campaign
        </button>
        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-3">
          <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Your campaigns
          </h2>
          {sorted.length === 0 ? (
            <p className="px-2 py-4 text-sm text-[var(--foreground-muted)]">No campaigns yet.</p>
          ) : (
            <ul className="max-h-[min(60vh,520px)] space-y-1 overflow-y-auto">
              {sorted.map((c) => {
                const active = selectedId === c._id && !createOpen;
                return (
                  <li key={c._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateOpen(false);
                        setSelectedId(c._id);
                        setMsg(null);
                        setErr(null);
                      }}
                      className={`flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        active ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/40" : "hover:bg-[var(--surface)]"
                      }`}
                    >
                      <span className="font-medium capitalize">{c.status ?? "—"}</span>
                      <span className="text-xs text-[var(--foreground-muted)]">
                        {c.objective ?? "—"} · {c.contentType ?? "—"} · budget {c.budgetCoins ?? 0}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="text-xs text-[var(--foreground-subtle)]">
          Need store discounts?{" "}
          <Link href="/dashboard/store" className="text-[var(--accent)] hover:underline">
            Store workspace
          </Link>
        </p>
      </aside>

      <section className="lg:col-span-8">
        {createOpen ? (
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Megaphone className="size-5 text-amber-400" />
              Create campaign
            </h2>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              Choose the exact post or reel you want to promote. Budget and objective apply to that piece of content
              only.
            </p>
            {pickerLoading ? (
              <p className="mt-6 flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                <Loader2 className="size-4 animate-spin" /> Loading your content…
              </p>
            ) : (
              <form onSubmit={(e) => void submitCreate(e)} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="content-pick" className="text-xs font-medium text-[var(--foreground-muted)]">
                    Content
                  </label>
                  <select
                    id="content-pick"
                    value={pickerValue}
                    onChange={(e) => setPickerValue(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    required
                  >
                    <option value="">Select a post or reel…</option>
                    {picker.map((p) => (
                      <option key={p._id} value={p._id}>
                        {contentOptionLabel(p)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                    Only published items appear here. Upload or publish from the Bromo app first.
                  </p>
                </div>
                <div>
                  <label htmlFor="budget" className="text-xs font-medium text-[var(--foreground-muted)]">
                    Budget (Bromo coins)
                  </label>
                  <input
                    id="budget"
                    type="number"
                    min={100}
                    value={budgetCoins}
                    onChange={(e) => setBudgetCoins(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="obj" className="text-xs font-medium text-[var(--foreground-muted)]">
                    Objective
                  </label>
                  <select
                    id="obj"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    {OBJECTIVES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {err ? <p className="text-sm text-[var(--destructive)]">{err}</p> : null}
                {msg ? <p className="text-sm text-[var(--success)]">{msg}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={formBusy}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-60"
                  >
                    {formBusy ? "Saving…" : "Save as draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateOpen(false);
                      setErr(null);
                      setMsg(null);
                    }}
                    className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : selectedId ? (
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
            {detailLoading ? (
              <p className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </p>
            ) : detail ? (
              <>
                <h2 className="text-lg font-semibold capitalize">Campaign · {detail.status ?? "—"}</h2>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--foreground-muted)]">Objective</dt>
                    <dd className="font-medium">{String(detail.objective ?? "—")}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--foreground-muted)]">Content</dt>
                    <dd className="font-medium">
                      {String(detail.contentType ?? "—")} ·{" "}
                      <span className="font-mono text-xs">{String(detail.contentId ?? "—")}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--foreground-muted)]">Budget</dt>
                    <dd className="font-medium tabular-nums">{Number(detail.budgetCoins ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--foreground-muted)]">Spent</dt>
                    <dd className="font-medium tabular-nums">{Number(detail.spentCoins ?? 0)}</dd>
                  </div>
                </dl>
                <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--hairline)] pt-6">
                  {detail.status === "draft" ? (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void postAction("activate")}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      <Play className="size-4" />
                      Start (activate)
                    </button>
                  ) : null}
                  {detail.status === "paused" ? (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void postAction("resume")}
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-60"
                    >
                      <Play className="size-4" />
                      Resume
                    </button>
                  ) : null}
                  {detail.status === "active" ? (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void postAction("pause")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface)] disabled:opacity-60"
                    >
                      <Pause className="size-4" />
                      Pause
                    </button>
                  ) : null}
                </div>
                <p className="mt-4 text-xs text-[var(--foreground-subtle)]">
                  Activation needs a verified email, enough remaining budget on the campaign, and at least 50 Bromo
                  coins in your wallet (same rules as the app).
                </p>
                {err ? <p className="mt-2 text-sm text-[var(--destructive)]">{err}</p> : null}
                {msg ? <p className="mt-2 text-sm text-[var(--success)]">{msg}</p> : null}
              </>
            ) : (
              <p className="text-sm text-[var(--foreground-muted)]">Select a campaign from the list.</p>
            )}
          </div>
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]/40 p-8 text-center">
            <Megaphone className="size-10 text-[var(--foreground-subtle)] opacity-40" />
            <p className="mt-3 text-sm font-medium text-[var(--foreground)]">Choose a campaign or create one</p>
            <p className="mt-1 max-w-md text-xs text-[var(--foreground-muted)]">
              Pick an item from the left to manage it, or start a new paid push for any published post or reel.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
