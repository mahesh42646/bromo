"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useDashboardLogout() {
  const router = useRouter();
  return useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);
}
