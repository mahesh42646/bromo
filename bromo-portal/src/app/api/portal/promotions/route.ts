import { NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function POST(req: Request) {
  const body = await req.text();
  const res = await apiWithAuth("/promotions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const out = await res.text();
  return new NextResponse(out, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
