import bromoConfig from "../../../bromo-config.json";

const apiBaseUrl =
  (process.env.NEXT_PUBLIC_API_URL ?? String(bromoConfig.apiBaseUrl ?? "")).trim().replace(/\/+$/, "");

/** Server-side Express URL used for admin server actions & route handlers. */
const apiInternalUrl =
  (process.env.API_INTERNAL_URL ?? String(bromoConfig.apiInternalUrl ?? bromoConfig.apiBaseUrl ?? "")).trim().replace(
    /\/+$/,
    "",
  );

export const settings = {
  apiBaseUrl,
  apiInternalUrl,
  appEnv: process.env.NODE_ENV,
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
} as const;
