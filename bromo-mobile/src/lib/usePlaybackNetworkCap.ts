/**
 * usePlaybackNetworkCap — NetInfo-aware ABR ceiling.
 *
 * Returns:
 *   maxHeight: 720 on cellular, 1080 on WiFi/unmetered
 *   isCellular: true when on mobile data
 *   maxBitRate: bps cap for react-native-video (null = uncapped)
 *
 * Uses @react-native-community/netinfo for connection type detection.
 */

import {useEffect, useState} from 'react';
import NetInfo, {type NetInfoState} from '@react-native-community/netinfo';

export type PlaybackNetworkCap = {
  maxHeight: 720 | 1080;
  isCellular: boolean;
  /** Max bitrate in bps for react-native-video; null means uncapped (WiFi). */
  maxBitRate: number | null;
};

const CELLULAR_CAP_BPS = 3_000_000; // 3 Mbps ≈ top of 720p rung

function deriveCapFromState(state: NetInfoState): PlaybackNetworkCap {
  const isCellular =
    state.type === 'cellular' ||
    (state.type === 'other' && !state.isConnected);
  const isWifi = state.type === 'wifi' || state.type === 'ethernet' || state.type === 'wimax';
  // isConnectionExpensive catches hotspot + metered connections on Android
  const isExpensive = state.details && 'isConnectionExpensive' in state.details
    ? (state.details as {isConnectionExpensive?: boolean}).isConnectionExpensive ?? false
    : false;

  const capped = isCellular || isExpensive;
  return {
    maxHeight: (capped && !isWifi) ? 720 : 1080,
    isCellular: capped,
    maxBitRate: (capped && !isWifi) ? CELLULAR_CAP_BPS : null,
  };
}

export function usePlaybackNetworkCap(): PlaybackNetworkCap {
  const [cap, setCap] = useState<PlaybackNetworkCap>({
    maxHeight: 1080,
    isCellular: false,
    maxBitRate: null,
  });

  useEffect(() => {
    // Initial fetch
    NetInfo.fetch().then((state) => {
      setCap(deriveCapFromState(state));
    });

    // Subscribe to changes
    const unsub = NetInfo.addEventListener((state) => {
      setCap(deriveCapFromState(state));
    });

    return unsub;
  }, []);

  return cap;
}
