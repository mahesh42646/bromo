import {Linking} from 'react-native';

/** Ensure http(s) and other schemes open reliably (bare domains get https://). */
export function normalizeExternalUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  return `https://${t}`;
}

export async function openExternalUrl(raw: string): Promise<boolean> {
  const url = normalizeExternalUrl(raw);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      /* fall through */
    }
    return false;
  }
}
