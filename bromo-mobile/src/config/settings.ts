import bromoConfig from '../../bromo-config.json';

const apiBaseUrl = String(bromoConfig.apiBaseUrl ?? '')
  .trim()
  .replace(/\/+$/, '');

/** CloudFront (or S3 website) for `/uploads/*` — empty = use apiBaseUrl. */
const cdnBaseUrlStatic = String((bromoConfig as {cdnBaseUrl?: string}).cdnBaseUrl ?? '')
  .trim()
  .replace(/\/+$/, '');

/** Overridden when `/settings/public` returns `media.cdnBaseUrl` (no app rebuild). */
let cdnBaseUrlRuntime = '';

/** Set CDN origin for `/uploads/*`. Empty string clears runtime override (use config + api base). */
export function setRuntimeCdnBaseUrl(url: string | undefined | null): void {
  cdnBaseUrlRuntime = String(url ?? '').trim().replace(/\/+$/, '');
}

export function mediaBaseUrl(): string {
  return cdnBaseUrlRuntime || cdnBaseUrlStatic || apiBaseUrl;
}

export const settings = {
  apiBaseUrl,
  get cdnBaseUrl(): string {
    return mediaBaseUrl();
  },
  // Optional web proxy endpoint (if you expose theme via bromo-web)
  webThemeContractUrl: '',
  // Poll admin settings once per minute; cached in AsyncStorage between opens
  themeRefreshMs: 60_000,
  enableAnalytics: false,
} as const;
