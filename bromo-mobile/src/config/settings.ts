import bromoConfig from '../../bromo-config.json';

const apiBaseUrl = String(bromoConfig.apiBaseUrl ?? '')
  .trim()
  .replace(/\/+$/, '');

/** CloudFront (or S3 website) for `/uploads/*` — empty = use apiBaseUrl. */
const cdnBaseUrlStatic = String((bromoConfig as {cdnBaseUrl?: string}).cdnBaseUrl ?? '')
  .trim()
  .replace(/\/+$/, '');

export function mediaBaseUrl(): string {
  return cdnBaseUrlStatic || apiBaseUrl;
}

export const appBranding = {
  platformName: String((bromoConfig as {platformName?: string}).platformName ?? 'BROMO'),
  adminTitle: String((bromoConfig as {adminTitle?: string}).adminTitle ?? 'BROMO Admin'),
  appTitle: String((bromoConfig as {appTitle?: string}).appTitle ?? 'BROMO'),
  logoUrl: String((bromoConfig as {logoUrl?: string}).logoUrl ?? ''),
  faviconUrl: String((bromoConfig as {faviconUrl?: string}).faviconUrl ?? ''),
} as const;

export const settings = {
  apiBaseUrl,
  get cdnBaseUrl(): string {
    return mediaBaseUrl();
  },
  enableAnalytics: false,
} as const;
