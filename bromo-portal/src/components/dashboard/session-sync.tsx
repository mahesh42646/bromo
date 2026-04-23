"use client";

import { useEffect } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

/** Keeps the httpOnly session cookie aligned with refreshed Firebase ID tokens. */
export function SessionSync() {
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = auth.onIdTokenChanged(async (user) => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      } catch {
        /* ignore network blips */
      }
    });
    const interval = window.setInterval(
      () => {
        void auth.currentUser?.getIdToken(true).then(async (idToken) => {
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
        });
      },
      25 * 60 * 1000,
    );
    const onFocus = () => {
      void auth.currentUser?.getIdToken(true).then(async (idToken) => {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return null;
}
