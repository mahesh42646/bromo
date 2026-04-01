export const routes = {
  home: "/",
  adminLogin: "/admin/login",
  adminDashboard: "/admin/dashboard",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
