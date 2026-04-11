import bromoConfig from '../../bromo-config.json';

const apiBaseUrl = String(bromoConfig.apiBaseUrl ?? '')
  .trim()
  .replace(/\/+$/, '');

export const settings = {
  apiBaseUrl,
  // Optional web proxy endpoint (if you expose theme via bromo-web)
  webThemeContractUrl: '',
  // Poll admin settings once per minute; cached in AsyncStorage between opens
  themeRefreshMs: 60_000,
  enableAnalytics: false,
} as const;
