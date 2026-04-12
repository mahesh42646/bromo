import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";
import { settings } from "@/config/settings";

const API = settings.apiInternalUrl;

async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
}

export async function POST(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const token = await getToken();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { postId } = await params;
  const upstream = await fetch(`${API}/admin/posts/${postId}/restore`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
