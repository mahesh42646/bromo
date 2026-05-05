import {useEffect, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';

/** True when the app UI is active (foreground). Used for Instagram-style in-app call UI without system CallKit while dev lacks VoIP entitlements. */
export function useAppInForeground(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    const onChange = (s: AppStateStatus) => setActive(s === 'active');
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);
  return active;
}
