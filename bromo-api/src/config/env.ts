import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const defaultJwtSecret = "dev-only-change-in-production";
const jwtSecret = required(
  "JWT_SECRET",
  nodeEnv === "production" ? undefined : defaultJwtSecret,
).trim();

if (nodeEnv === "production" && jwtSecret === defaultJwtSecret) {
  throw new Error("JWT_SECRET must be set to a non-default value in production");
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/bromo_admin"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  adminSessionTtl: process.env.ADMIN_SESSION_TTL ?? "8h",
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  nodeEnv,
} as const;
