const DEFAULT_PUBLIC = "https://bromo.darkunde.in";

/** Public origin for `/uploads/*` (must match what the mobile app can reach). */
export function getPublicApiOrigin(): string {
  return (process.env.PUBLIC_API_BASE_URL ?? DEFAULT_PUBLIC).trim().replace(/\/+$/, "");
}

/**
 * Normalize media URLs stored with wrong host (localhost, internal IP, old domain)
 * so iOS/Android can fetch over HTTPS from the same host as the API.
 */
export function rewritePublicMediaUrl(url: string): string {
  const base = getPublicApiOrigin();
  try {
    const u = new URL(url);
    if (u.pathname.startsWith("/uploads/")) {
      return `${base}${u.pathname}${u.search}`;
    }
  } catch {
    if (url.startsWith("/uploads/")) {
      return `${base}${url}`;
    }
  }
  return url;
}
