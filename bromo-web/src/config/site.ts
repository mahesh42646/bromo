export const siteConfig = {
  platformName: "BROMO",
  adminTitle: "BROMO Admin",
  appTitle: "BROMO",
  description: "BROMO platform operations and product console.",
  adminSessionTtl: process.env.ADMIN_SESSION_TTL ?? "8h",
} as const;
