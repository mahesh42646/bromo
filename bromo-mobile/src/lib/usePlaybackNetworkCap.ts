/**
 * usePlaybackNetworkCap — NetInfo-aware ABR ceiling.
 *
 * Safe when native module is not yet linked (pod install not run).
 * Defaults to WiFi/uncapped in that case — HLS player handles its own ABR.
 */

import {useEffect, useState} from 'react';

export type PlaybackNetworkCap = {
  maxHeight: 360 | 720 | 1080;
  isCellular: boolean;
  maxBitRate: number | null;
};

const DEFAULT_CAP: PlaybackNetworkCap = {
  maxHeight: 360,
  isCellular: false,
  maxBitRate: 700_000,
};

// Hard-locked to the 360p variant on ALL networks. ABR was probing multiple quality
// tiers concurrently, triggering hundreds of segment requests per reel view and
// saturating the server (1 reel → 20+ duplicate segment fetches). Single locked
// tier = predictable load + zero buffering on sub-1 Mbps connections.
const CELLULAR_CAP_BPS = 500_000;  // 500 kbps hard cap
const WIFI_CAP_BPS = 700_000;      // 700 kbps hard cap (same 360p rung)

/** Lazy require — avoids crash when RNCNetInfo native module is not linked yet. */
function tryGetNetInfo(): null | {
  fetch: () => Promise<unknown>;
  addEventListener: (cb: (s: unknown) => void) => () => void;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/netinfo');
    const api = mod?.default ?? mod;
    if (typeof api?.fetch !== 'function') return null;
    return api;
  } catch {
    return null;
  }
}

function deriveCapFromState(state: unknown): PlaybackNetworkCap {
  if (!state || typeof state !== 'object') return DEFAULT_CAP;
  const s = state as {
    type?: string;
    isConnected?: boolean;
    details?: {isConnectionExpensive?: boolean};
  };

  const isCellular = s.type === 'cellular';
  const isWifi = s.type === 'wifi' || s.type === 'ethernet' || s.type === 'wimax';
  const isExpensive = s.details?.isConnectionExpensive ?? false;
  const capped = isCellular || (!isWifi && isExpensive);

  return {
    maxHeight: 360,
    isCellular: capped,
    maxBitRate: capped ? CELLULAR_CAP_BPS : WIFI_CAP_BPS,
  };
}

export function usePlaybackNetworkCap(): PlaybackNetworkCap {
  const [cap, setCap] = useState<PlaybackNetworkCap>(DEFAULT_CAP);

  useEffect(() => {
    const netInfo = tryGetNetInfo();
    if (!netInfo) return; // native module not linked — use defaults silently

    let mounted = true;
    netInfo.fetch().then((state: unknown) => {
      if (mounted) setCap(deriveCapFromState(state));
    }).catch(() => null);

    const unsub = netInfo.addEventListener((state: unknown) => {
      if (mounted) setCap(deriveCapFromState(state));
    });

    return () => {
      mounted = false;
      try { unsub(); } catch { /* ignore */ }
    };
  }, []);

  return cap;
}
