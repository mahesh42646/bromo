"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/dashboard/content?q=${encodeURIComponent(term)}` : "/dashboard/content");
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto hidden max-w-xl flex-1 px-4 md:block lg:px-8">
      <label htmlFor="dash-search" className="sr-only">
        Search dashboard
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--foreground-subtle)]" />
        <input
          id="dash-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search content, drafts, store…"
          className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-11 pr-4 text-sm text-[var(--foreground)] outline-none ring-[var(--accent)]/0 transition-[box-shadow,border-color] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)]/35 focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </div>
    </form>
  );
}
