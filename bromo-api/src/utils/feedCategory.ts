/** Slug for home-feed buckets (posts/reels only; not story). */
export function normalizeFeedCategory(raw: string | undefined | null): string {
  const s = String(raw ?? "general")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 48);
  return s || "general";
}
