import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { LRUCache } from "lru-cache";
import { getAuth } from "../config/firebase.js";
import { User, type UserDoc } from "../models/User.js";

export type FirebaseAuthedRequest = Request & {
  firebaseUser?: {
    uid: string;
    email: string;
    emailVerified: boolean;
  };
  dbUser?: UserDoc;
};

type TokenCacheEntry = {
  uid: string;
  email: string;
  emailVerified: boolean;
  dbUser: UserDoc | null;
};

// Cache decoded token results for 55 min (Firebase tokens expire at 60 min).
// Key = first 32 hex chars of SHA-256(token) — never stores raw JWT in memory.
// Invalidated naturally when token expires and client sends a new one.
const tokenCache = new LRUCache<string, TokenCacheEntry>({
  max: 2000,
  ttl: 55 * 60 * 1000,
});

function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

async function resolveToken(token: string): Promise<TokenCacheEntry> {
  const key = tokenKey(token);
  const hit = tokenCache.get(key);
  if (hit) return hit;

  const decoded = await getAuth().verifyIdToken(token);
  const uid = decoded.uid;
  const entry: TokenCacheEntry = {
    uid,
    email: decoded.email ?? "",
    emailVerified: decoded.email_verified ?? false,
    dbUser: null,
  };

  // Fetch DB user and cache alongside auth claims in one round-trip.
  const dbUser = await User.findOne({ firebaseUid: uid }).lean() as UserDoc | null;
  entry.dbUser = dbUser;
  tokenCache.set(key, entry);
  return entry;
}

/** Evict a token from the cache (call on logout or profile mutation). */
export function invalidateCachedToken(token: string): void {
  tokenCache.delete(tokenKey(token));
}

/** Evict all cached entries for a given Firebase UID (e.g. after role change). */
export function invalidateCachedUid(uid: string): void {
  for (const [key, entry] of tokenCache.entries()) {
    if (entry.uid === uid) tokenCache.delete(key);
  }
}

export async function requireFirebaseToken(
  req: FirebaseAuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authorization token required" });
  }

  try {
    const entry = await resolveToken(token);
    req.firebaseUser = {
      uid: entry.uid,
      email: entry.email,
      emailVerified: entry.emailVerified,
    };
    if (entry.dbUser) req.dbUser = entry.dbUser;
    return next();
  } catch (err) {
    console.error("[firebaseAuth] Token verification failed:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function requireVerifiedUser(
  req: FirebaseAuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authorization token required" });
  }

  try {
    const entry = await resolveToken(token);
    req.firebaseUser = {
      uid: entry.uid,
      email: entry.email,
      emailVerified: entry.emailVerified,
    };

    if (!entry.dbUser) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    if (!entry.dbUser.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    req.dbUser = entry.dbUser;
    return next();
  } catch (err) {
    console.error("[firebaseAuth] Token verification failed:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
