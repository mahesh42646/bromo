"use client";

import { useState } from "react";
import { Edit2, Eye, FileText, Globe, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type PageStatus = "published" | "draft" | "archived";

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  template: string;
  author: string;
  locale: string;
  updatedAt: string;
  publishedAt: string | null;
  views: number;
}

const PAGES: CmsPage[] = [
  { id: "1", title: "Terms of Service", slug: "/terms", status: "published", template: "Legal", author: "Super Admin", locale: "en", updatedAt: "2026-04-01", publishedAt: "2026-01-01", views: 4820 },
  { id: "2", title: "Privacy Policy", slug: "/privacy", status: "published", template: "Legal", author: "Super Admin", locale: "en", updatedAt: "2026-04-01", publishedAt: "2026-01-01", views: 3140 },
  { id: "3", title: "About Bromo", slug: "/about", status: "published", template: "Marketing", author: "Content Manager", locale: "en", updatedAt: "2026-03-20", publishedAt: "2026-02-01", views: 8900 },
  { id: "4", title: "Help Center", slug: "/help", status: "published", template: "Support", author: "Content Manager", locale: "en", updatedAt: "2026-04-05", publishedAt: "2026-02-15", views: 12400 },
  { id: "5", title: "Creator Program", slug: "/creators", status: "draft", template: "Marketing", author: "Content Manager", locale: "en", updatedAt: "2026-04-06", publishedAt: null, views: 0 },
  { id: "6", title: "Cookie Policy", slug: "/cookies", status: "draft", template: "Legal", author: "Super Admin", locale: "en", updatedAt: "2026-03-15", publishedAt: null, views: 0 },
  { id: "7", title: "Changelog", slug: "/changelog", status: "archived", template: "Blog", author: "Content Manager", locale: "en", updatedAt: "2026-01-01", publishedAt: "2025-12-01", views: 2100 },
];

const STATUS_STYLES: Record<PageStatus, string> = {
  published: "bg-success/15 text-success",
  draft: "bg-warning/15 text-warning",
  archived: "bg-muted text-muted-foreground",
};

export function AdminCmsPages() {
  const [pages, setPages] = useState(PAGES);
  const [filter, setFilter] = useState<PageStatus | "">("");
  const [search, setSearch] = useState("");

  const visible = pages.filter((p) => {
    if (filter && p.status !== filter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">CMS pages</h1>
          <p className="text-muted-foreground mt-1 text-sm">Structured content blocks and publication workflow.</p>
        </div>
        <button className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="size-4" />
          New page
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Published", value: pages.filter((p) => p.status === "published").length, color: "text-success" },
          { label: "Drafts", value: pages.filter((p) => p.status === "draft").length, color: "text-warning" },
          { label: "Total views", value: pages.reduce((s, p) => s + p.views, 0).toLocaleString(), color: "text-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pages…"
          className="border-input bg-background text-foreground placeholder:text-placeholder min-w-48 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-1">
          {(["", "published", "draft", "archived"] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => setFilter(s as PageStatus | "")}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-colors",
                filter === s ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Page", "Slug", "Template", "Status", "Views", "Updated", "Actions"].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((page) => (
                <tr key={page.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                      <span className="text-foreground font-medium">{page.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <code className="text-muted-foreground text-xs">{page.slug}</code>
                  </td>
                  <td className="px-5 py-3">
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]">{page.template}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[page.status])}>
                      {page.status}
                    </span>
                  </td>
                  <td className="text-foreground px-5 py-3 tabular-nums">{page.views.toLocaleString()}</td>
                  <td className="text-muted-foreground px-5 py-3 text-xs">{page.updatedAt}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button title="Preview" className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors">
                        <Eye className="size-4" />
                      </button>
                      <button title="Edit" className="text-muted-foreground hover:text-accent rounded-lg p-1.5 transition-colors">
                        <Edit2 className="size-4" />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setPages((prev) => prev.filter((p) => p.id !== page.id))}
                        className="text-muted-foreground hover:text-destructive rounded-lg p-1.5 transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      {page.status === "draft" && (
                        <button
                          title="Publish"
                          onClick={() => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, status: "published" as PageStatus, publishedAt: new Date().toISOString().slice(0, 10) } : p))}
                          className="text-muted-foreground hover:text-success rounded-lg p-1.5 transition-colors"
                        >
                          <Globe className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
