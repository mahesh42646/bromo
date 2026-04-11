"use client";

import { useState } from "react";
import { Film, Grid3X3, Image, List, Search, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MediaType = "image" | "video" | "audio";
type ViewMode = "grid" | "list";

interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  size: string;
  dimensions: string;
  url: string;
  uploader: string;
  uploadedAt: string;
  usageCount: number;
}

const ASSETS: MediaAsset[] = [
  { id: "1", name: "hero-banner.jpg", type: "image", size: "420 KB", dimensions: "1920×1080", url: "", uploader: "Content Manager", uploadedAt: "2026-04-06", usageCount: 8 },
  { id: "2", name: "app-promo.mp4", type: "video", size: "12.4 MB", dimensions: "1080×1920", url: "", uploader: "Super Admin", uploadedAt: "2026-04-05", usageCount: 3 },
  { id: "3", name: "logo-dark.svg", type: "image", size: "8 KB", dimensions: "400×120", url: "", uploader: "Super Admin", uploadedAt: "2026-01-15", usageCount: 42 },
  { id: "4", name: "favicon-32.png", type: "image", size: "2 KB", dimensions: "32×32", url: "", uploader: "Super Admin", uploadedAt: "2026-01-15", usageCount: 1 },
  { id: "5", name: "onboarding-v2.mp4", type: "video", size: "8.1 MB", dimensions: "1080×1920", url: "", uploader: "Content Manager", uploadedAt: "2026-03-10", usageCount: 5 },
  { id: "6", name: "profile-placeholder.png", type: "image", size: "14 KB", dimensions: "400×400", url: "", uploader: "Super Admin", uploadedAt: "2026-02-01", usageCount: 2840 },
  { id: "7", name: "og-image.jpg", type: "image", size: "180 KB", dimensions: "1200×630", url: "", uploader: "Content Manager", uploadedAt: "2026-03-25", usageCount: 12 },
  { id: "8", name: "terms-doc.pdf", type: "audio", size: "340 KB", dimensions: "—", url: "", uploader: "Super Admin", uploadedAt: "2026-01-01", usageCount: 0 },
];

const TYPE_ICON: Record<MediaType, React.ComponentType<{ className?: string }>> = {
  image: Image,
  video: Film,
  audio: Film,
};

function MediaTile({ asset, selected, onSelect, onDelete }: {
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const Icon = TYPE_ICON[asset.type];
  return (
    <div
      onClick={onSelect}
      className={cn(
        "border-border brand-surface group relative cursor-pointer overflow-hidden rounded-2xl border transition-all",
        selected ? "ring-2 ring-ring" : "hover:border-border-mid",
      )}
    >
      <div className="bg-muted/60 flex aspect-square items-center justify-center">
        <Icon className="text-muted-foreground size-10 opacity-40" />
        {selected && (
          <div className="bg-accent absolute right-2 top-2 flex size-5 items-center justify-center rounded-full">
            <span className="text-xs font-bold text-white">✓</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-foreground truncate text-xs font-medium">{asset.name}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{asset.size} · {asset.dimensions}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-muted-foreground hover:text-destructive absolute right-2 bottom-9 hidden rounded-lg p-1 group-hover:flex"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function AdminMediaLibrary() {
  const [assets, setAssets] = useState(ASSETS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaType | "">("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const visible = assets.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && a.type !== typeFilter) return false;
    return true;
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    setAssets((prev) => prev.filter((a) => !selected.has(a.id)));
    setSelected(new Set());
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Media library</h1>
          <p className="text-muted-foreground mt-1 text-sm">Centralized assets, CDN metadata, and usage tracking.</p>
        </div>
        <label className="bg-accent text-accent-foreground flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
          <Upload className="size-4" />
          Upload
          <input type="file" multiple accept="image/*,video/*" className="sr-only" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total assets", value: assets.length },
          { label: "Images", value: assets.filter((a) => a.type === "image").length },
          { label: "Videos", value: assets.filter((a) => a.type === "video").length },
          { label: "Total size", value: "21.4 MB" },
        ].map(({ label, value }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…"
            className="border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as MediaType | "")} className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
        <div className="border-border flex rounded-xl border p-0.5">
          <button onClick={() => setViewMode("grid")} className={cn("rounded-lg p-2", viewMode === "grid" ? "bg-muted" : "text-muted-foreground")}><Grid3X3 className="size-4" /></button>
          <button onClick={() => setViewMode("list")} className={cn("rounded-lg p-2", viewMode === "list" ? "bg-muted" : "text-muted-foreground")}><List className="size-4" /></button>
        </div>
        {selected.size > 0 && (
          <button onClick={deleteSelected} className="bg-destructive/10 text-destructive flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium">
            <Trash2 className="size-4" /> Delete ({selected.size})
          </button>
        )}
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {visible.map((asset) => (
            <MediaTile
              key={asset.id}
              asset={asset}
              selected={selected.has(asset.id)}
              onSelect={() => toggleSelect(asset.id)}
              onDelete={() => setAssets((prev) => prev.filter((a) => a.id !== asset.id))}
            />
          ))}
        </div>
      ) : (
        <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {["Asset", "Type", "Size", "Dimensions", "Uploader", "Uploaded", "Used", ""].map((h) => (
                  <th key={h} className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((a) => {
                const Icon = TYPE_ICON[a.type];
                return (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="text-muted-foreground size-4" />
                        <span className="text-foreground font-medium">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] capitalize">{a.type}</span></td>
                    <td className="text-muted-foreground px-5 py-3 text-xs">{a.size}</td>
                    <td className="text-muted-foreground px-5 py-3 text-xs">{a.dimensions}</td>
                    <td className="text-muted-foreground px-5 py-3 text-xs">{a.uploader}</td>
                    <td className="text-muted-foreground px-5 py-3 text-xs">{a.uploadedAt}</td>
                    <td className="text-muted-foreground px-5 py-3 text-xs tabular-nums">{a.usageCount}x</td>
                    <td className="px-5 py-3">
                      <button onClick={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))} className="text-muted-foreground hover:text-destructive rounded-lg p-1.5">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
