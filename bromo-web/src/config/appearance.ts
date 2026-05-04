/** localStorage key for web appearance preference (light / dark / system). */
export const WEB_APPEARANCE_STORAGE_KEY = "bromo-appearance" as const;

export type WebAppearanceMode = "light" | "dark" | "system";
