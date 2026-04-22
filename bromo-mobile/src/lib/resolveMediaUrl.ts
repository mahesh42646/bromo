import {settings} from '../config/settings';

/**
 * Point `/uploads/*` at CDN when configured, else API host — keeps media off the app server.
 */
export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url?.trim()) return '';
  const u = url.trim();
  const base = (settings.cdnBaseUrl || settings.apiBaseUrl).replace(/\/+$/, '');
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
