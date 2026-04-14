const DEFAULT_PUBLIC = "https://bromo.darkunde.in";

/** Public origin for `/uploads/*` (must match what the mobile app can reach). */
export function getPublicApiOrigin(): string {
  return (process.env.PUBLIC_API_BASE_URL ?? DEFAULT_PUBLIC).trim().replace(/\/+$/, "");
}

/**
 * CDN base URL for static assets (segments, images).
 * Defaults to PUBLIC_API_BASE_URL (same-origin) until a CDN is configured.
 * Set CDN_BASE_URL env var to point at CloudFront / Cloudflare.
 */
export function getCdnBaseUrl(): string {
  const cdn = process.env.CDN_BASE_URL;
  if (cdn?.trim()) return cdn.trim().replace(/\/+$/, "");
  return getPublicApiOrigin();
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

/**
 * Build a CDN-backed public URL for an HLS master playlist or segment.
 * HLS files live under /uploads/hls/<jobId>/...
 */
export function hlsPublicUrl(relPath: string): string {
  const base = getCdnBaseUrl();
  const clean = relPath.replace(/^\/+/, "");
  return `${base}/uploads/${clean}`;
}

/**
 * Given an HLS master URL, derive the cellular-capped variant.
 * Convention: master.m3u8 → master_cell.m3u8 (same dir).
 */
export function hlsCellularMasterUrl(masterUrl: string): string {
  return masterUrl.replace(/master\.m3u8$/, "master_cell.m3u8");
}
