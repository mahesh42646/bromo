"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  redirect("/admin/login");
}
