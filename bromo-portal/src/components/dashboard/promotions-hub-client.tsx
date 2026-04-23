"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, Megaphone, Percent, Store, UserRound, Zap } from "lucide-react";

type Campaign = {
  _id: string;
  status?: string;
  budgetCoins?: number;
  spentCoins?: number;
  objective?: string;
  contentType?: string;
};

type HubTab = "content" | "profile" | "store";

const OBJECTIVES = [
  { value: "reach", label: "Reach — show to more people" },
  { value: "engagement", label: "Engagement — comments & reactions" },
  { value: "followers", label: "Followers — grow your audience" },
  { value: "traffic", label: "Traffic — tap through to a link" },
] as const;

export function PromotionsHubClient({
  initialCampaigns,
  prefilledContentId,
  prefilledContentType,
}: {
  initialCampaigns: Campaign[];
  prefilledContentId?: string;
  prefilledContentType?: string;
}) {
  const [tab, setTab] = useState<HubTab>("content");
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [contentId, setContentId] = useState(prefilledContentId ?? "");
  const [contentType, setContentType] = useState<"post" | "reel" | "story">(
    (prefilledContentType === "reel" || prefilledContentType === "story" || prefilledContentType === "post"
      ? prefilledContentType
      : "reel") as "post" | "reel" | "story",
  );
  const [budgetCoins, setBudgetCoins] = useState("500");
  const [objective, setObjective] = useState<string>("reach");

  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => String(b._id).localeCompare(String(a._id))),
    [campaigns],
  );

  async function createContentCampaign(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: contentId.trim(),
          contentType,
          budgetCoins: Number(budgetCoins),
          objective,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; campaign?: Campaign };
      if (!res.ok) {
        setError(data.message ?? "Could not create campaign");
        return;
      }
      if (data.campaign) setCampaigns((c) => [data.campaign as Campaign, ...c]);
      setMessage("Draft campaign saved. Activate it when your wallet is funded and email is verified.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-1">
        {(
          [
            { id: "content" as const, label: "Content campaigns", Icon: Megaphone },
            { id: "profile" as const, label: "Profile & reach", Icon: UserRound },
            { id: "store" as const, label: "Store & offers", Icon: Store },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium sm:flex-none sm:px-4 ${
              tab === id
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-md"
                : "text-[var(--foreground-muted)] hover:bg-white/5"
            }`}
          >
            <Icon className="size-4 opacity-90" />
            {label}
          </button>
        ))}
      </div>

      {tab === "content" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Zap className="size-5 text-amber-400" />
              New content campaign
            </h2>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              Promote a post, reel, or story you already published. Budgets use Bromo coins; delivery follows the same
              promotion pipeline as the mobile app.
            </p>
            <form onSubmit={(e) => void createContentCampaign(e)} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)]">Content ID</label>
                <input
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder="Mongo _id from Content library"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)]">Format</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as "post" | "reel" | "story")}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  <option value="reel">Reel</option>
                  <option value="post">Post</option>
                  <option value="story">Story</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)]">Budget (coins)</label>
                <input
                  type="number"
                  min={100}
                  value={budgetCoins}
                  onChange={(e) => setBudgetCoins(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)]">Objective</label>
                <select
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
              {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
              {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save draft campaign"}
              </button>
            </form>
          </section>

          <section className="space-y-4 rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="size-5 text-sky-400" />
              Active & draft campaigns
            </h2>
            <p className="text-sm text-[var(--foreground-muted)]">
              Pause, resume, and review spend from the app for now; this table mirrors everything the API returns.
            </p>
            {sorted.length === 0 ? (
              <p className="text-sm text-[var(--foreground-muted)]">No campaigns yet — create one on the left.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--hairline)]">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-[var(--hairline)] bg-[var(--surface)] text-xs uppercase text-[var(--foreground-muted)]">
                    <tr>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Objective</th>
                      <th className="px-3 py-2">Content</th>
                      <th className="px-3 py-2">Budget</th>
                      <th className="px-3 py-2">Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((c) => (
                      <tr key={c._id} className="border-b border-[var(--hairline)] last:border-0">
                        <td className="px-3 py-2 font-medium">{c.status ?? "—"}</td>
                        <td className="px-3 py-2 text-[var(--foreground-muted)]">{c.objective ?? "—"}</td>
                        <td className="px-3 py-2 text-[var(--foreground-muted)]">{c.contentType ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{c.budgetCoins ?? 0}</td>
                        <td className="px-3 py-2 tabular-nums">{c.spentCoins ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "profile" ? (
        <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-semibold">Profile & discovery</h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Run campaigns that point people to your profile, highlights, or external links. Objective presets above
            (followers, traffic) map to the same promotion engine — tie them to a flagship reel or post that explains
            who you are.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-[var(--foreground-muted)]">
            <li>Pick a hero clip in Content library, then create a campaign with the &quot;followers&quot; or &quot;traffic&quot; objective.</li>
            <li>Use the CTA fields in the app for deep links (store, newsletter, ticketed events).</li>
            <li>Audience placements (feed, explore, reels tray) are honored when you edit the draft on mobile.</li>
          </ul>
          <Link
            href="/dashboard/content"
            className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Choose hero content →
          </Link>
        </section>
      ) : null}

      {tab === "store" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Percent className="size-5 text-emerald-400" />
              Store & discount campaigns
            </h2>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              Bromo stores are built for full merchandising depth — today we optimize for local, in-person, or manual
              fulfillment. When you enable delivery and courier partners, the same catalog will power nationwide shipping
              with Amazon-grade inventory controls.
            </p>
            <div className="mt-4 space-y-3 rounded-xl border border-dashed border-[var(--hairline)] bg-[var(--surface)] p-4 text-sm text-[var(--foreground-muted)]">
              <p className="font-medium text-[var(--foreground)]">Coming next</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Product-level promo codes and flash markdowns</li>
                <li>Buy-one-get-one bundles for reels tagged with SKUs</li>
                <li>Automated recovery messages for abandoned carts (chat)</li>
              </ul>
            </div>
            <Link
              href="/dashboard/store"
              className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Open store workspace →
            </Link>
          </div>
          <div className="rounded-2xl border border-pink-500/25 bg-pink-500/[0.06] p-6">
            <h3 className="font-semibold text-pink-200">Discount-first playbook</h3>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              Until automated store promotions ship, pair a limited-time coupon code with a promoted reel that demos the
              product. Mention the code in-caption so redemptions stay measurable offline.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
