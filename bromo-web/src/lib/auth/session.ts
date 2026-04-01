import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "./cookie";
import { verifyAdminSessionToken, type AdminSessionPayload } from "./verify-session";

export async function readAdminSession(): Promise<AdminSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}
