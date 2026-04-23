function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Server-side Bromo API origin (no trailing slash). */
export function getApiBase(): string {
  const fromEnv =
    process.env.API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "";
  if (!fromEnv) {
    throw new Error("Set API_BASE_URL or NEXT_PUBLIC_API_BASE_URL for bromo-portal");
  }
  return trimBase(fromEnv);
}

/** Client-side API base for direct fetch (e.g. username lookup before Firebase). */
export function getPublicApiBase(): string {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!v) throw new Error("NEXT_PUBLIC_API_BASE_URL is required in the browser");
  return trimBase(v);
}
