/** Resolve upload-relative paths against the public API origin (client-safe). */
export function publicMediaUrl(path: string | undefined | null): string | null {
  const p = String(path ?? "").trim();
  if (!p) return null;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!base) return p.startsWith("/") ? p : `/${p}`;
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}
