"use client";

import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

function requireWebConfig(): FirebaseOptions {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim();

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_* env vars. Copy your Web app config from Firebase console into .env.local",
    );
  }

  const config: FirebaseOptions = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
  if (measurementId) {
    config.measurementId = measurementId;
  }
  return config;
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let analyticsInstance: Analytics | null | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(requireWebConfig());
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

/**
 * Analytics only runs in the browser. Call from `useEffect` (e.g. via `FirebaseAnalyticsInit`).
 * Returns null if `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is unset or the environment blocks analytics.
 */
export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (analyticsInstance !== undefined) return analyticsInstance;

  const mid = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim();
  if (!mid) {
    analyticsInstance = null;
    return null;
  }

  try {
    if (!(await isSupported())) {
      analyticsInstance = null;
      return null;
    }
    analyticsInstance = getAnalytics(getFirebaseApp());
    return analyticsInstance;
  } catch {
    analyticsInstance = null;
    return null;
  }
}
