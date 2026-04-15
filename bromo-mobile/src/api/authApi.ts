import {getAuth} from '@react-native-firebase/auth';
import {settings} from '../config/settings';
import {navigationRef, resetToAuth} from '../navigation/rootNavigation';

export function apiBase(): string {
  const base = settings.apiBaseUrl?.trim().replace(/\/+$/, '');
  if (base) return base;
  return 'https://bromo.darkunde.in';
}

/**
 * Firebase **ID tokens** always expire (~1h). The SDK refreshes them using the long-lived
 * refresh token when you call `getIdToken`. Do not cache the JWT string against a wall-clock
 * TTL — that can return an expired token after the real `exp` has passed.
 */
export async function getIdToken(forceRefresh = false): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken(forceRefresh);
}

/** @deprecated Firebase holds token state; kept for call sites that clear after logout. */
export function invalidateTokenCache(): void {
  /* no-op */
}

const FETCH_TIMEOUT_MS = 20_000;

let sessionExpiredPromise: Promise<void> | null = null;

function scheduleResetToAuth(attempt = 0): void {
  if (navigationRef.isReady()) {
    resetToAuth();
    return;
  }
  if (attempt < 30) {
    setTimeout(() => scheduleResetToAuth(attempt + 1), 100);
  }
}

async function handleSessionExpiredAndNavigate(): Promise<void> {
  if (sessionExpiredPromise) {
    await sessionExpiredPromise;
    return;
  }
  sessionExpiredPromise = (async () => {
    try {
      const {socketService} = await import('../services/socketService');
      socketService.disconnect();
      await getAuth().signOut();
      scheduleResetToAuth();
    } catch {
      scheduleResetToAuth();
    }
  })();
  try {
    await sessionExpiredPromise;
  } finally {
    sessionExpiredPromise = null;
  }
}

function mergeAuthHeaders(init: RequestInit, token: string): RequestInit {
  const h = new Headers(init.headers as ConstructorParameters<typeof Headers>[0]);
  h.set('Authorization', `Bearer ${token}`);
  if (!(init.body instanceof FormData) && !h.has('Content-Type')) {
    h.set('Content-Type', 'application/json');
  }
  return {...init, headers: h};
}

/**
 * Authenticated `fetch` with timeout, one 401 retry using a forced ID-token refresh,
 * then sign-out + navigate to Auth if the session cannot be recovered.
 */
export async function authorizedFetch(fullUrl: string, init: RequestInit = {}): Promise<Response> {
  const doFetchWithTimeout = async (reqInit: RequestInit, timeoutMs: number): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(fullUrl, {...reqInit, signal: ctrl.signal});
    } finally {
      clearTimeout(timer);
    }
  };
  let token = await getIdToken(false);
  let reqInit = mergeAuthHeaders(init, token);
  let res: Response;
  try {
    res = await doFetchWithTimeout(reqInit, FETCH_TIMEOUT_MS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/aborted|network request failed|timeout/i.test(msg)) {
      res = await doFetchWithTimeout(reqInit, FETCH_TIMEOUT_MS + 8_000);
    } else {
      throw err;
    }
  }
  if (res.status === 401) {
    try {
      token = await getIdToken(true);
      reqInit = mergeAuthHeaders(init, token);
      res = await doFetchWithTimeout(reqInit, FETCH_TIMEOUT_MS);
    } catch {
      await handleSessionExpiredAndNavigate();
      return res;
    }
    if (res.status === 401) {
      await handleSessionExpiredAndNavigate();
    }
  }
  return res;
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return authorizedFetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export type DbUser = {
  _id: string;
  firebaseUid: string;
  email: string;
  username: string;
  displayName: string;
  emailVerified: boolean;
  profilePicture: string;
  bio: string;
  phone: string;
  website: string;
  provider: 'email' | 'google';
  isActive: boolean;
  onboardingComplete: boolean;
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
};

export async function getEmailByUsername(username: string): Promise<{email: string}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(
      `${apiBase()}/user-auth/email-by-username/${encodeURIComponent(username)}`,
      {signal: ctrl.signal},
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as {message?: string}).message ?? 'Username not found');
    }
    return res.json() as Promise<{email: string}>;
  } finally {
    clearTimeout(timer);
  }
}

export async function registerUser(displayName: string, phone?: string): Promise<{user: DbUser; created: boolean}> {
  const res = await authedFetch('/user-auth/register', {
    method: 'POST',
    body: JSON.stringify({displayName, phone: phone ?? ''}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Registration failed');
  }
  return res.json() as Promise<{user: DbUser; created: boolean}>;
}

export async function googleAuth(
  displayName: string,
  photoURL?: string,
): Promise<{user: DbUser; created: boolean}> {
  const res = await authedFetch('/user-auth/google', {
    method: 'POST',
    body: JSON.stringify({displayName, photoURL}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Google sign-in failed');
  }
  return res.json() as Promise<{user: DbUser; created: boolean}>;
}

export async function getMe(): Promise<{user: DbUser} | {needsRegistration: true}> {
  const res = await authedFetch('/user-auth/me');
  if (res.status === 404) {
    return {needsRegistration: true};
  }
  if (!res.ok) {
    throw new Error('Failed to fetch profile');
  }
  return res.json() as Promise<{user: DbUser}>;
}

export async function checkUsername(
  username: string,
): Promise<{available: boolean; error?: string; suggestions: string[]}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(
      `${apiBase()}/user-auth/check-username/${encodeURIComponent(username)}`,
      {signal: ctrl.signal},
    );
    if (!res.ok) throw new Error('Check failed');
    return res.json() as Promise<{available: boolean; error?: string; suggestions: string[]}>;
  } finally {
    clearTimeout(timer);
  }
}

export async function setUsername(
  username: string,
): Promise<{user: DbUser} | {message: string; suggestions?: string[]}> {
  const res = await authedFetch('/user-auth/username', {
    method: 'POST',
    body: JSON.stringify({username}),
  });
  const body = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error((body as {message?: string}).message ?? 'Failed'), body);
  }
  return body as {user: DbUser};
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${apiBase()}/user-auth/forgot-password`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Failed');
  }
}

export async function updateProfile(data: {
  displayName?: string;
  bio?: string;
  profilePicture?: string;
  phone?: string;
  website?: string;
}): Promise<{user: DbUser}> {
  const res = await authedFetch('/user-auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Update failed');
  }
  return res.json() as Promise<{user: DbUser}>;
}

export async function uploadAvatar(localUri: string): Promise<{url: string}> {
  const base = apiBase();

  const form = new FormData();
  const filename = localUri.split('/').pop() ?? 'avatar.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = {jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};
  form.append('avatar', {uri: localUri, type: mimeMap[ext] ?? 'image/jpeg', name: filename} as unknown as Blob);

  const res = await authorizedFetch(`${base}/media/avatar`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Upload failed');
  }
  return res.json() as Promise<{url: string}>;
}
