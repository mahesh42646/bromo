import auth from '@react-native-firebase/auth';
import {settings} from '../config/settings';

function apiBase(): string {
  const base = settings.apiBaseUrl?.trim().replace(/\/+$/, '');
  if (base) return base;
  return 'https://bromo.darkunde.in';
}

async function getIdToken(): Promise<string> {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken(true);
}

const FETCH_TIMEOUT_MS = 12_000;

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const token = await getIdToken();
    return await fetch(`${apiBase()}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } finally {
    clearTimeout(timer);
  }
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
  provider: 'email' | 'google';
  isActive: boolean;
  onboardingComplete: boolean;
};

export async function registerUser(displayName: string): Promise<{user: DbUser; created: boolean}> {
  const res = await authedFetch('/user-auth/register', {
    method: 'POST',
    body: JSON.stringify({displayName}),
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
