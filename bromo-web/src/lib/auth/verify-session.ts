import * as jose from "jose";

export type AdminSessionPayload = {
  sub: string;
  email?: string;
  role?: string;
};

function getSecretKey(): Uint8Array {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(raw);
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSessionPayload | null> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jose.jwtVerify(token, secretKey, {
      issuer: "bromo-api",
      audience: "bromo-admin",
      algorithms: ["HS256"],
      clockTolerance: "30s",
    });
    if (payload.sub === undefined || payload.sub === null) return null;
    const sub = typeof payload.sub === "string" ? payload.sub : String(payload.sub);
    if (!sub) return null;
    return {
      sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
    };
  } catch {
    return null;
  }
}
