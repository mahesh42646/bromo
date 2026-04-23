"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, LineChart, Sparkles, Store } from "lucide-react";
import { ContentMixCard } from "@/components/dashboard/premium/content-mix-card";
import { StatMetricCard } from "@/components/dashboard/premium/stat-metric-card";
import { ViewsTrendChart } from "@/components/dashboard/premium/views-trend-chart";
import { cn } from "@/lib/cn";

export type OverviewStats = {
  gridTotal: number;
  postCount: number;
  reelCount: number;
  totalViews: number;
  draftCount: number;
  promoCount: number;
  unreadCount: number;
  hasStore: boolean;
};

export function DashboardOverview({ stats }: { stats: OverviewStats }) {
  return (
    <div className="space-y-8 lg:space-y-10">
      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className={cn("dash-glass lg:col-span-2 rounded-[1.75rem] ring-1 ring-white/[0.07]")}
        >
          <ViewsTrendChart totalViews={stats.totalViews} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="dash-glass rounded-[1.75rem] ring-1 ring-white/[0.07]"
        >
          <ContentMixCard
            postCount={stats.postCount}
            reelCount={stats.reelCount}
            draftCount={stats.draftCount}
          />
        </motion.div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatMetricCard
          href="/dashboard/content"
          label="Published grid"
          value={stats.gridTotal}
          hint={`${stats.postCount} posts · ${stats.reelCount} reels`}
          icon={Sparkles}
          sparkSeed="grid"
          sparkColor="#ff4d6d"
          delay={0.08}
        />
        <StatMetricCard
          href="/dashboard/content"
          label="Drafts in progress"
          value={stats.draftCount}
          hint="Polish captions & publish from app"
          icon={Sparkles}
          sparkSeed="drafts"
          sparkColor="#f97316"
          delay={0.12}
        />
        <StatMetricCard
          href="/dashboard/promotions"
          label="Promotions"
          value={stats.promoCount}
          hint="Boost content you own"
          icon={LineChart}
          sparkSeed="promo"
          sparkColor="#a855f7"
          highlight
          delay={0.16}
        />
        <StatMetricCard
          href="/dashboard/notifications"
          label="Unread"
          value={stats.unreadCount}
          hint="Triage alerts"
          icon={Bell}
          sparkSeed="notif"
          sparkColor="#22c55e"
          delay={0.2}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="dash-glass rounded-[1.75rem] p-6 ring-1 ring-white/[0.07] sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--accent)]/15 p-3 ring-1 ring-[var(--accent)]/25">
              <Store className="size-6 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Store</h2>
              <p className="text-sm text-[var(--foreground-muted)]">
                {stats.hasStore
                  ? "Storefront linked — refine merchandising on the web."
                  : "Create a store from the app, then configure it here."}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/store"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium ring-1 ring-white/10 transition-colors hover:bg-[var(--accent)]/15 hover:ring-[var(--accent)]/30"
          >
            Open store workspace
          </Link>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="dash-glass rounded-[1.75rem] p-6 ring-1 ring-white/[0.07] sm:p-8"
        >
          <h2 className="text-lg font-semibold">This workspace</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Deep profile edits, drafts, store ops, promotion budgets, and notifications. Feed scrolling and DMs stay in
            the mobile app — this surface is tuned for focus.
          </p>
          <Link href="/" className="mt-6 inline-flex text-sm font-medium text-[var(--accent)] hover:underline">
            ← Back to marketing site
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
