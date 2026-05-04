import {
  WEB_APPEARANCE_STORAGE_KEY,
  type WebAppearanceMode,
} from "@/config/appearance";

export function readStoredAppearanceMode(): WebAppearanceMode {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(WEB_APPEARANCE_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

export function resolveAppearanceToTheme(mode: WebAppearanceMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyAppearanceToDocument(mode: WebAppearanceMode): void {
  if (typeof document === "undefined") return;
  const next = resolveAppearanceToTheme(mode);
  document.documentElement.setAttribute("data-theme", next);
}

export function persistAppearanceMode(mode: WebAppearanceMode): void {
  try {
    window.localStorage.setItem(WEB_APPEARANCE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function buildAppearanceBootScript(storageKey: string): string {
  return `(function(){try{var k=${JSON.stringify(storageKey)};var v=localStorage.getItem(k);var sysDark=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=v==="light"||v==="dark"?v:(sysDark?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
}
