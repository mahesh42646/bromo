import type { Request, Response, NextFunction } from "express";
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

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
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
    const decoded = await getAuth().verifyIdToken(token);
    req.firebaseUser = {
      uid: decoded.uid,
      email: decoded.email ?? "",
      emailVerified: decoded.email_verified ?? false,
    };

    const dbUser = await User.findOne({ firebaseUid: decoded.uid });
    if (dbUser) {
      req.dbUser = dbUser;
    }

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
    const decoded = await getAuth().verifyIdToken(token);
    req.firebaseUser = {
      uid: decoded.uid,
      email: decoded.email ?? "",
      emailVerified: decoded.email_verified ?? false,
    };

    const dbUser = await User.findOne({ firebaseUid: decoded.uid });
    if (!dbUser) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    if (!dbUser.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    req.dbUser = dbUser;
    return next();
  } catch (err) {
    console.error("[firebaseAuth] Token verification failed:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
