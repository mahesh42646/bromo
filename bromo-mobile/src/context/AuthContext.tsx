import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import auth, {type FirebaseAuthTypes} from '@react-native-firebase/auth';
import {socketService} from '../services/socketService';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type DbUser,
  getMe,
  registerUser,
  googleAuth as googleAuthApi,
  setUsername as setUsernameApi,
  getEmailByUsername,
  invalidateTokenCache,
} from '../api/authApi';

const K_ONBOARD = '@bromo/onboarding_done';
const K_DB_USER = '@bromo/db_user_v1';

GoogleSignin.configure({
  iosClientId:
    '877911020224-4cuqme08t2r15dn3p8kun0pucrbeqdec.apps.googleusercontent.com',
  webClientId: '877911020224-vllent8n0nosnl16l4rh8oo6nt2kv58g.apps.googleusercontent.com', // REQUIRED for Google Sign-In — see FIREBASE_SETUP.md step 3
});

export type AuthState = {
  ready: boolean;
  onboardingDone: boolean;
  firebaseUser: FirebaseAuthTypes.User | null;
  dbUser: DbUser | null;
  needsEmailVerification: boolean;
  needsUsername: boolean;
  needsRegistration: boolean;
};

export type AuthActions = {
  completeOnboarding: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string, phone?: string) => Promise<void>;
  loginWithEmail: (identifier: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  checkEmailVerified: () => Promise<boolean>;
  forgotPassword: (email: string) => Promise<void>;
  setUsername: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshDbUser: () => Promise<void>;
};

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [ready, setReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(K_ONBOARD).then(v => {
      setOnboardingDone(v === '1');
    });
  }, []);

  useEffect(() => {
    // Load cached dbUser instantly so the app feels fast
    AsyncStorage.getItem(K_DB_USER).then(raw => {
      if (raw) {
        try { setDbUser(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async user => {
      setFirebaseUser(user);
      if (user) {
        try {
          const result = await getMe();
          if ('needsRegistration' in result) {
            setDbUser(null);
            AsyncStorage.removeItem(K_DB_USER);
            socketService.disconnect();
          } else {
            setDbUser(result.user);
            AsyncStorage.setItem(K_DB_USER, JSON.stringify(result.user));
            // Connect socket after successful auth
            socketService.connect().catch(() => null);
          }
        } catch {
          // keep cached value if network fails
          socketService.connect().catch(() => null);
        }
      } else {
        setDbUser(null);
        AsyncStorage.removeItem(K_DB_USER);
        socketService.disconnect();
      }
      if (initializing) {
        setInitializing(false);
        setReady(true);
      }
    });
    return unsubscribe;
  }, [initializing]);

  const needsEmailVerification = useMemo(() => {
    if (!firebaseUser) return false;
    return !firebaseUser.emailVerified && dbUser?.provider !== 'google';
  }, [firebaseUser, dbUser]);

  const needsUsername = useMemo(() => {
    if (!firebaseUser) return false;
    if (!dbUser) return false;
    return !dbUser.username || !dbUser.onboardingComplete;
  }, [firebaseUser, dbUser]);

  const needsRegistration = useMemo(() => {
    if (!firebaseUser) return false;
    return dbUser === null;
  }, [firebaseUser, dbUser]);

  const completeOnboarding = useCallback(async () => {
    setOnboardingDone(true);
    await AsyncStorage.setItem(K_ONBOARD, '1');
  }, []);

  const registerWithEmail = useCallback(
    async (email: string, password: string, displayName: string, phone?: string) => {
      const credential = await auth().createUserWithEmailAndPassword(email, password);
      await credential.user.updateProfile({displayName});
      await credential.user.sendEmailVerification();

      try {
        const result = await registerUser(displayName, phone);
        setDbUser(result.user);
      } catch {
        // Will be created on next /me check
      }
    },
    [],
  );

  const loginWithEmail = useCallback(async (identifier: string, password: string) => {
    let email = identifier;
    if (!identifier.includes('@')) {
      const result = await getEmailByUsername(identifier);
      email = result.email;
    }
    await auth().signInWithEmailAndPassword(email, password);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;
    if (!idToken) throw new Error('Google Sign-In failed — no ID token');
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const result = await auth().signInWithCredential(googleCredential);

    try {
      const apiResult = await googleAuthApi(
        result.user.displayName ?? result.user.email?.split('@')[0] ?? 'User',
        result.user.photoURL ?? undefined,
      );
      setDbUser(apiResult.user);
    } catch {
      // googleAuthApi failed — user may already exist (race with onAuthStateChanged).
      // Do a final getMe() to ensure dbUser is consistent before navigation fires.
      try {
        const me = await getMe();
        if ('user' in me) setDbUser(me.user);
      } catch {}
    }
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    const user = auth().currentUser;
    if (user) await user.sendEmailVerification();
  }, []);

  const checkEmailVerified = useCallback(async (): Promise<boolean> => {
    const user = auth().currentUser;
    if (!user) return false;
    await user.reload();
    setFirebaseUser({...user} as FirebaseAuthTypes.User);
    if (user.emailVerified) {
      if (dbUser && !dbUser.emailVerified) {
        try {
          const result = await getMe();
          if ('user' in result) setDbUser(result.user);
        } catch {}
      }
      return true;
    }
    return false;
  }, [dbUser]);

  const forgotPassword = useCallback(async (email: string) => {
    await auth().sendPasswordResetEmail(email);
  }, []);

  const setUsernameAction = useCallback(async (username: string) => {
    try {
      const result = await setUsernameApi(username);
      if ('user' in result) {
        setDbUser(result.user);
      }
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      // Existing Firebase accounts may not have a DB user yet.
      // Create one from Firebase profile, then retry username set once.
      if (!msg.toLowerCase().includes('not registered')) {
        throw err;
      }
    }

    const fallbackName =
      auth().currentUser?.displayName?.trim() ||
      auth().currentUser?.email?.split('@')[0] ||
      'User';
    const reg = await registerUser(fallbackName);
    setDbUser(reg.user);

    const retried = await setUsernameApi(username);
    if ('user' in retried) {
      setDbUser(retried.user);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
    } catch {}
    invalidateTokenCache();
    await auth().signOut();
    setDbUser(null);
    AsyncStorage.removeItem(K_DB_USER);
  }, []);

  const refreshDbUser = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const result = await getMe();
      if ('user' in result) {
        setDbUser(result.user);
        AsyncStorage.setItem(K_DB_USER, JSON.stringify(result.user));
      }
    } catch {}
  }, [firebaseUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      onboardingDone,
      firebaseUser,
      dbUser,
      needsEmailVerification,
      needsUsername,
      needsRegistration,
      completeOnboarding,
      registerWithEmail,
      loginWithEmail,
      loginWithGoogle,
      sendVerificationEmail,
      checkEmailVerified,
      forgotPassword,
      setUsername: setUsernameAction,
      logout,
      refreshDbUser,
    }),
    [
      ready,
      onboardingDone,
      firebaseUser,
      dbUser,
      needsEmailVerification,
      needsUsername,
      needsRegistration,
      completeOnboarding,
      registerWithEmail,
      loginWithEmail,
      loginWithGoogle,
      sendVerificationEmail,
      checkEmailVerified,
      forgotPassword,
      setUsernameAction,
      logout,
      refreshDbUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
}
