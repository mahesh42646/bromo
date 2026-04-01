import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";
import { settings } from "@/config/settings";

const API_INTERNAL_URL = settings.apiInternalUrl;

async function forward(req: Request, method: "GET" | "PUT"): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (method === "PUT") {
    const body = await req.json().catch(() => null);
    (init as RequestInit).body = JSON.stringify(body ?? {});
  }

  const upstream = await fetch(`${API_INTERNAL_URL}/settings`, init);
  const data = await upstream.json().catch(() => ({}));

  return NextResponse.json(data, { status: upstream.status });
}

export async function GET(request: Request) {
  return forward(request, "GET");
}

export async function PUT(request: Request) {
  return forward(request, "PUT");
}

