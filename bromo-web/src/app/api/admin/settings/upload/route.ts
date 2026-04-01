import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";
import { settings } from "@/config/settings";

const API_INTERNAL_URL = settings.apiInternalUrl;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const incoming = await request.formData();
  const file = incoming.get("file");
  const type = incoming.get("type");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File is required" }, { status: 400 });
  }

  const body = new FormData();
  body.append("file", file);
  const safeType = type === "favicon" ? "favicon" : "logo";

  const upstream = await fetch(
    `${API_INTERNAL_URL}/settings/upload?type=${safeType}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    },
  );
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

