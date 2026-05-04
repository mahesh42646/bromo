"use client";

import { useEffect } from "react";
import { WEB_APPEARANCE_STORAGE_KEY } from "@/config/appearance";
import {
  applyAppearanceToDocument,
  readStoredAppearanceMode,
} from "@/lib/web-appearance";

export function WebAppearanceSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      const mode = readStoredAppearanceMode();
      if (mode === "system") applyAppearanceToDocument("system");
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === WEB_APPEARANCE_STORAGE_KEY || ev.key === null) {
        applyAppearanceToDocument(readStoredAppearanceMode());
      }
    };
    mq.addEventListener("change", onScheme);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onScheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
