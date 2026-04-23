import { NextResponse } from "next/server";

const MAX_LEN = 8000;

type Body = {
  name?: string;
  email?: string;
  subject?: string;
  category?: string;
  message?: string;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  const b = raw !== null && typeof raw === "object" ? (raw as Body) : {};
  const name = String(b.name ?? "").trim().slice(0, 200);
  const email = String(b.email ?? "").trim().slice(0, 320);
  const subject = String(b.subject ?? "").trim().slice(0, 200);
  const category = String(b.category ?? "general").trim().slice(0, 64);
  const message = String(b.message ?? "").trim().slice(0, MAX_LEN);

  if (!name || !email || !message) {
    return NextResponse.json({ message: "Name, email, and message are required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ message: "Invalid email" }, { status: 400 });
  }

  const payload = {
    source: "bromo-portal",
    createdAt: new Date().toISOString(),
    name,
    email,
    subject: subject || "(no subject)",
    category,
    message,
  };

  const webhook = process.env.SUPPORT_TICKET_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      const upstream = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!upstream.ok) {
        return NextResponse.json({ message: "Support service unavailable. Try again or email us." }, { status: 502 });
      }
    } catch {
      return NextResponse.json({ message: "Support service unavailable. Try again or email us." }, { status: 502 });
    }
  } else {
    console.info("[support-ticket]", JSON.stringify(payload));
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
