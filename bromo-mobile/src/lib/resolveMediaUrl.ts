import {apiBase} from '../api/authApi';

/**
 * Point `/uploads/*` at the same host as `apiBase()` so stored URLs from
 * localhost or old deployments still play on device.
 */
export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url?.trim()) return '';
  const u = url.trim();
  const base = apiBase().replace(/\/+$/, '');
  try {
    const parsed = new URL(u);
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${base}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    if (u.startsWith('/uploads/')) {
      return `${base}${u}`;
    }
  }
  return u;
}
