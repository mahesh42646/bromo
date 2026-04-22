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
  maxHeight: 720,
  isCellular: false,
  maxBitRate: 2_500_000,
};

const CELLULAR_CAP_BPS = 900_000;
const WIFI_CAP_BPS = 4_500_000;

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
    details?: {isConnectionExpensive?: boolean; cellularGeneration?: '2g' | '3g' | '4g' | '5g' | null; downlink?: number | null};
  };

  const isCellular = s.type === 'cellular';
  const isWifi = s.type === 'wifi' || s.type === 'ethernet' || s.type === 'wimax';
  const isExpensive = s.details?.isConnectionExpensive ?? false;
  const cellularGen = s.details?.cellularGeneration ?? null;
  const downlink = typeof s.details?.downlink === 'number' ? s.details.downlink : null;
  const capped = isCellular || (!isWifi && isExpensive);
  const veryFastWifi = isWifi && (downlink == null || downlink >= 15);
  const fastCell = isCellular && (cellularGen === '5g' || cellularGen === '4g');

  return {
    maxHeight: veryFastWifi ? 1080 : fastCell ? 720 : 360,
    isCellular: capped,
    maxBitRate: capped ? (fastCell ? 1_800_000 : CELLULAR_CAP_BPS) : WIFI_CAP_BPS,
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
