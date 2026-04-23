"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getPublicApiBase } from "@/lib/env";

async function postSession(idToken: string): Promise<void> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Session failed");
  }
}

export function RegisterForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      await sendEmailVerification(cred.user);

      const idToken = await cred.user.getIdToken();
      const base = getPublicApiBase();
      const reg = await fetch(`${base}/user-auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ displayName: displayName.trim(), phone: "" }),
      });
      if (!reg.ok) {
        const body = (await reg.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Could not create profile");
      }

      await postSession(idToken);
      setInfo("Check your inbox to verify your email. You can still open the studio for drafting.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
    >
      <h1 className="text-xl font-semibold tracking-tight">Create your studio account</h1>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        This registers the same Firebase + Bromo user as the mobile app.
      </p>
      {error ? (
        <p className="mt-4 rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mt-4 rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
          {info}
        </p>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="dn" className="block text-xs font-medium text-[var(--foreground-muted)]">
            Display name
          </label>
          <input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            required
          />
        </div>
        <div>
          <label htmlFor="em" className="block text-xs font-medium text-[var(--foreground-muted)]">
            Email
          </label>
          <input
            id="em"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            required
          />
        </div>
        <div>
          <label htmlFor="pw" className="block text-xs font-medium text-[var(--foreground-muted)]">
            Password
          </label>
          <input
            id="pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign up
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Log in
        </Link>
      </p>
    </motion.div>
  );
}
