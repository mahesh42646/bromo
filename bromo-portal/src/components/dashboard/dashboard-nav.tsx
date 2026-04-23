import { Bell, LayoutDashboard, LineChart, Sparkles, Store, UserRound } from "lucide-react";

export const dashboardNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  { href: "/dashboard/content", label: "Content & drafts", icon: Sparkles },
  { href: "/dashboard/store", label: "Store", icon: Store },
  { href: "/dashboard/promotions", label: "Promotions", icon: LineChart },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
] as const;
