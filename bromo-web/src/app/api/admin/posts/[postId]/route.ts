import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";
import { settings } from "@/config/settings";

const API = settings.apiInternalUrl;

async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const token = await getToken();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { postId } = await params;
  const body = await req.json().catch(() => ({}));
  const upstream = await fetch(`${API}/admin/posts/${postId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const token = await getToken();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { postId } = await params;
  const body = await req.json().catch(() => ({}));
  const upstream = await fetch(`${API}/admin/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
