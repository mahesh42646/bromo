"use client";

import { useEffect } from "react";
import { initFirebaseAnalytics } from "@/lib/firebase/client";

/** Initializes Firebase Analytics once on the client when `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is set. */
export function FirebaseAnalyticsInit() {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);
  return null;
}
