import bromoConfig from '../../bromo-config.json';

const apiBaseUrlRaw = String(bromoConfig.apiBaseUrl ?? '')
  .trim()
  .replace(/\/+$/, '');

/** CloudFront (or S3 website) for `/uploads/*` — empty = use api base. */
const cdnBaseUrlStatic = String((bromoConfig as {cdnBaseUrl?: string}).cdnBaseUrl ?? '')
  .trim()
  .replace(/\/+$/, '');
const shareHostStatic = String((bromoConfig as {shareHost?: string}).shareHost ?? apiBaseUrlRaw)
  .trim()
  .replace(/\/+$/, '');

/** Hostname only (no scheme) for universal links / intent-filters. Override when shareHost URL and link host differ. */
function parseUniversalLinkHost(): string {
  const raw = String((bromoConfig as {universalLinkHost?: string}).universalLinkHost ?? '').trim();
  if (raw) {
    const noProto = raw.replace(/^https?:\/\//i, '');
    return noProto.split('/')[0] ?? noProto;
  }
  const src = shareHostStatic || apiBaseUrlRaw;
  if (!src) return 'localhost';
  try {
    const u = new URL(src.startsWith('http') ? src : `https://${src}`);
    return u.hostname;
  } catch {
    return 'localhost';
  }
}

export const universalLinkHost = parseUniversalLinkHost();

function resolveApiBaseUrl(): string {
  if (apiBaseUrlRaw) return apiBaseUrlRaw;
  if (universalLinkHost && universalLinkHost !== 'localhost') {
    return `https://${universalLinkHost}`;
  }
  return 'http://127.0.0.1:4000';
}

const apiBaseUrlResolved = resolveApiBaseUrl();

export function mediaBaseUrl(): string {
  return cdnBaseUrlStatic || apiBaseUrlResolved;
}

export const appBranding = {
  platformName: String((bromoConfig as {platformName?: string}).platformName ?? 'BROMO'),
  adminTitle: String((bromoConfig as {adminTitle?: string}).adminTitle ?? 'BROMO Admin'),
  appTitle: String((bromoConfig as {appTitle?: string}).appTitle ?? 'BROMO'),
  logoUrl: String((bromoConfig as {logoUrl?: string}).logoUrl ?? ''),
  faviconUrl: String((bromoConfig as {faviconUrl?: string}).faviconUrl ?? ''),
} as const;

export const settings = {
  apiBaseUrl: apiBaseUrlResolved,
  shareHost: shareHostStatic || apiBaseUrlResolved,
  get cdnBaseUrl(): string {
    return mediaBaseUrl();
  },
  enableAnalytics: false,
} as const;
