"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getPublicApiBase } from "@/lib/env";

async function postSession(idToken: string): Promise<{ needsRegistration?: boolean; message?: string }> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    needsRegistration?: boolean;
    message?: string;
  };
  if (res.status === 428) return { needsRegistration: true };
  if (!res.ok) return { message: data.message ?? "Could not start session" };
  return {};
}

async function registerBackend(displayName: string, idToken: string): Promise<void> {
  const base = getPublicApiBase();
  const res = await fetch(`${base}/user-auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ displayName, phone: "" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Registration failed");
  }
}

async function googleBackend(displayName: string, photoURL: string | undefined, idToken: string): Promise<void> {
  const base = getPublicApiBase();
  const res = await fetch(`${base}/user-auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ displayName, photoURL: photoURL ?? "" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Google sync failed");
  }
}

async function resolveEmail(identifier: string): Promise<string> {
  if (identifier.includes("@")) return identifier.trim();
  const base = getPublicApiBase();
  const res = await fetch(
    `${base}/user-auth/email-by-username/${encodeURIComponent(identifier.trim().toLowerCase())}`,
  );
  if (!res.ok) throw new Error("Username not found");
  const data = (await res.json()) as { email: string };
  return data.email;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const n = searchParams.get("next");
    if (n?.startsWith("/") && !n.startsWith("//")) return n;
    return "/dashboard";
  }, [searchParams]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishSession = useCallback(
    async (idToken: string) => {
      let r = await postSession(idToken);
      if (r.needsRegistration) {
        const auth = getFirebaseAuth();
        const u = auth.currentUser;
        if (!u) throw new Error("Not signed in");
        const name = u.displayName ?? u.email?.split("@")[0] ?? "Creator";
        await registerBackend(name, idToken);
        r = await postSession(idToken);
      }
      if (r.message) throw new Error(r.message);
      router.push(nextPath);
      router.refresh();
    },
    [nextPath, router],
  );

  async function onEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const email = await resolveEmail(identifier);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await finishSession(idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleLogin() {
    setError(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      try {
        await googleBackend(
          cred.user.displayName ?? cred.user.email?.split("@")[0] ?? "Creator",
          cred.user.photoURL ?? undefined,
          idToken,
        );
      } catch {
        /* race with existing user — session route will still work */
      }
      await finishSession(idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mx-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]"
    >
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        Use the same Bromo account as on mobile. No reels feed here — this is your creator studio.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}

      <form onSubmit={(e) => void onEmailLogin(e)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="id" className="block text-xs font-medium text-[var(--foreground-muted)]">
            Email or username
          </label>
          <input
            id="id"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none ring-[var(--ring)] transition-shadow focus:ring-2"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Continue
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--hairline)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-[var(--card)] px-2 text-[var(--foreground-subtle)]">or</span>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void onGoogleLogin()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-high)] disabled:opacity-60"
      >
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        New here?{" "}
        <Link href="/register" className="font-medium text-[var(--accent)] hover:underline">
          Create an account
        </Link>
      </p>
    </motion.div>
  );
}
