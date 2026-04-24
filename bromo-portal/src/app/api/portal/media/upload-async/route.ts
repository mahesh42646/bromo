import { NextResponse } from "next/server";
import { getApiBase } from "@/lib/env";
import { getPortalToken } from "@/lib/server-api";

export async function POST(req: Request) {
  const token = await getPortalToken();
  if (!token) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }
  const form = await req.formData();
  const category = (form.get("category")?.toString().trim() || "posts").toLowerCase();
  const base = getApiBase();
  const res = await fetch(`${base}/media/upload-async?category=${encodeURIComponent(category)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    cache: "no-store",
  });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
