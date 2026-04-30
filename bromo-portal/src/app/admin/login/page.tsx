import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-api";
import { getApiBase } from "@/lib/env";

async function loginAdmin(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const res = await fetch(`${getApiBase()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    redirect("/admin/login?error=1");
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) redirect("/admin/login?error=1");
  const jar = await cookies();
  jar.set(ADMIN_TOKEN_COOKIE, body.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  redirect("/admin/approvals");
}

export default function AdminLoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  return (
    <main className="min-h-screen bg-[#07080a] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">BROMO Admin</h1>
              <p className="text-sm text-white/55">Manual approvals and compliance review</p>
            </div>
          </div>
          <form action={loginAdmin} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Email</span>
              <input
                name="email"
                type="email"
                required
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none ring-emerald-400/50 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Password</span>
              <input
                name="password"
                type="password"
                required
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none ring-emerald-400/50 focus:ring-2"
              />
            </label>
            <LoginError searchParams={searchParams} />
            <button className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black">
              Sign in
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

async function LoginError({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = searchParams ? await searchParams : {};
  if (params?.error !== "1") return null;
  return <p className="rounded-xl bg-red-500/12 px-3 py-2 text-sm text-red-200">Invalid admin credentials.</p>;
}
