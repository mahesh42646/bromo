"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  postCount: number;
  reelCount: number;
  draftCount: number;
};

export function ContentMixCard({ postCount, reelCount, draftCount }: Props) {
  const total = Math.max(1, postCount + reelCount + draftCount);
  const rPost = Math.sqrt(postCount / total);
  const rReel = Math.sqrt(reelCount / total);
  const rDraft = Math.sqrt(draftCount / total);
  const maxR = Math.max(rPost, rReel, rDraft, 0.2);

  const norm = (r: number) => 22 + (r / maxR) * 38;

  return (
    <div className="relative flex h-full flex-col rounded-[1.75rem] p-6 sm:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">Mix</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">Content distribution</h3>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        Live counts from the API: profile grid posts and reels, plus every draft saved to your account (including
        story drafts). Bubble size reflects share of the total.
      </p>
      <div className="relative mt-8 flex min-h-[200px] flex-1 items-center justify-center">
        <div className="relative h-48 w-full max-w-[240px]">
          <motion.div
            className="absolute rounded-full bg-[#ff4d6d]/90 shadow-[0_0_40px_-8px_rgba(255,77,109,0.8)]"
            style={{
              width: norm(rPost),
              height: norm(rPost),
              left: "8%",
              top: "18%",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.05 }}
          />
          <motion.div
            className="absolute rounded-full bg-[#a855f7]/85 shadow-[0_0_36px_-8px_rgba(168,85,247,0.75)]"
            style={{
              width: norm(rReel),
              height: norm(rReel),
              right: "6%",
              top: "12%",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.12 }}
          />
          <motion.div
            className="absolute rounded-full bg-[#f97316]/80 shadow-[0_0_32px_-8px_rgba(249,115,22,0.7)]"
            style={{
              width: norm(rDraft),
              height: norm(rDraft),
              left: "28%",
              bottom: "6%",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.2 }}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs tabular-nums">
        <span className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
          <span className="size-2 shrink-0 rounded-full bg-[#ff4d6d]" aria-hidden />
          Posts <span className="font-medium text-[var(--foreground)]">{postCount}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
          <span className="size-2 shrink-0 rounded-full bg-[#a855f7]" aria-hidden />
          Reels <span className="font-medium text-[var(--foreground)]">{reelCount}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
          <span className="size-2 shrink-0 rounded-full bg-[#f97316]" aria-hidden />
          Drafts <span className="font-medium text-[var(--foreground)]">{draftCount}</span>
        </span>
      </div>
      <Link
        href="/dashboard/content"
        className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
      >
        Manage content <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
