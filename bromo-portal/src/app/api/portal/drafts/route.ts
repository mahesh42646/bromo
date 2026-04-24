import { NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET() {
  const res = await apiWithAuth("/drafts/");
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const bodyText = await req.text();
  const res = await apiWithAuth("/drafts/", {
    method: "POST",
    body: bodyText || "{}",
  });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
