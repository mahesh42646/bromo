import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

const K_ONBOARD = '@bromo/demo_onboarding_done';
const K_SESSION = '@bromo/demo_session';

export type DemoSession = {
  displayName: string;
  username: string;
  phone: string;
};

type DemoAuthValue = {
  ready: boolean;
  onboardingDone: boolean;
  session: DemoSession | null;
  completeOnboarding: () => Promise<void>;
  login: (session: DemoSession) => Promise<void>;
  logout: () => Promise<void>;
};

const DemoAuthContext = createContext<DemoAuthValue | null>(null);

export function DemoAuthProvider({children}: {children: React.ReactNode}) {
  const [ready, setReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [session, setSession] = useState<DemoSession | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [o, s] = await Promise.all([
          AsyncStorage.getItem(K_ONBOARD),
          AsyncStorage.getItem(K_SESSION),
        ]);
        setOnboardingDone(o === '1');
        setSession(s ? (JSON.parse(s) as DemoSession) : null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const completeOnboarding = useCallback(async () => {
    setOnboardingDone(true);
    await AsyncStorage.setItem(K_ONBOARD, '1');
  }, []);

  const login = useCallback(async (sess: DemoSession) => {
    setSession(sess);
    await AsyncStorage.setItem(K_SESSION, JSON.stringify(sess));
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
    await AsyncStorage.removeItem(K_SESSION);
  }, []);

  const value = useMemo(
    () => ({ready, onboardingDone, session, completeOnboarding, login, logout}),
    [ready, onboardingDone, session, completeOnboarding, login, logout],
  );

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

export function useDemoAuth(): DemoAuthValue {
  const ctx = useContext(DemoAuthContext);
  if (!ctx) throw new Error('useDemoAuth requires DemoAuthProvider');
  return ctx;
}
