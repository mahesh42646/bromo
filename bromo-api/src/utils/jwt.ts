import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtAdminPayload = {
  sub: string;
  email: string;
  role: string;
};

export function signAdminToken(
  payload: JwtAdminPayload,
  expiresIn?: string,
): string {
  const options: jwt.SignOptions = {
    expiresIn: (expiresIn ?? env.jwtExpiresIn) as NonNullable<
      jwt.SignOptions["expiresIn"]
    >,
    issuer: "bromo-api",
    audience: "bromo-admin",
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyAdminToken(token: string): JwtAdminPayload {
  const decoded = jwt.verify(token, env.jwtSecret, {
    issuer: "bromo-api",
    audience: "bromo-admin",
  }) as JwtAdminPayload & jwt.JwtPayload;
  return { sub: decoded.sub, email: decoded.email, role: decoded.role };
}
