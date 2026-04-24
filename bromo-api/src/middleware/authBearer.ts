import type { Request, Response, NextFunction } from "express";
import { Admin } from "../models/Admin.js";
import { verifyAdminToken } from "../utils/jwt.js";

type AdminRole = "super_admin" | "admin";

export type AuthedRequest = Request & {
  admin?: { id: string; email: string; role: AdminRole };
};

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function resolveActiveAdminFromRequest(req: Request): Promise<AuthedRequest["admin"] | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const payload = verifyAdminToken(token);
  const admin = await Admin.findById(payload.sub).select("email role isActive").lean<{
    _id: unknown;
    email: string;
    role: AdminRole;
    isActive: boolean;
  }>();
  if (!admin?.isActive) return null;
  return {
    id: String(admin._id),
    email: admin.email,
    role: admin.role,
  };
}

export async function requireAdminToken(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const admin = await resolveActiveAdminFromRequest(req);
    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.admin = admin;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export async function requireSuperAdminToken(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const admin = await resolveActiveAdminFromRequest(req);
    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (admin.role !== "super_admin") {
      return res.status(403).json({ message: "Super admin required" });
    }
    req.admin = admin;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
