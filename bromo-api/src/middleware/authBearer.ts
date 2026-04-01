import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../utils/jwt.js";

export type AuthedRequest = Request & {
  admin?: { id: string; email: string; role: string };
};

export function requireAdminToken(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = header.slice(7);
  try {
    const payload = verifyAdminToken(token);
    req.admin = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
