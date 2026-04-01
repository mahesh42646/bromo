import { User } from "../models/User.js";

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "bromo",
  "bromo_app",
  "bromo_admin",
  "support",
  "help",
  "official",
  "moderator",
  "mod",
  "system",
  "root",
  "null",
  "undefined",
  "api",
  "www",
  "mail",
  "store",
  "stores",
  "settings",
  "notifications",
  "explore",
  "search",
  "login",
  "register",
  "signup",
  "signin",
  "logout",
  "profile",
  "about",
  "terms",
  "privacy",
  "security",
  "wallet",
]);

export type UsernameValidation = {
  valid: boolean;
  error?: string;
};

export function validateUsername(username: string): UsernameValidation {
  if (!username) {
    return { valid: false, error: "Username is required" };
  }

  const u = username.toLowerCase().trim();

  if (u.length < 4) {
    return { valid: false, error: "Username must be at least 4 characters" };
  }
  if (u.length > 30) {
    return { valid: false, error: "Username cannot exceed 30 characters" };
  }

  if (!/^[a-z0-9._]+$/.test(u)) {
    return {
      valid: false,
      error: "Only letters, numbers, periods, and underscores allowed",
    };
  }

  if (u.startsWith(".") || u.endsWith(".")) {
    return {
      valid: false,
      error: "Username cannot start or end with a period",
    };
  }

  if (/\.\./.test(u)) {
    return { valid: false, error: "Username cannot contain consecutive periods" };
  }

  if (/^\d+$/.test(u)) {
    return { valid: false, error: "Username cannot be only numbers" };
  }

  if (RESERVED_USERNAMES.has(u)) {
    return { valid: false, error: "This username is not available" };
  }

  return { valid: true };
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const u = username.toLowerCase().trim();
  const existing = await User.findOne({ username: u }).lean();
  return !existing;
}

export async function generateSuggestions(
  base: string,
  count = 5,
): Promise<string[]> {
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "")
    .slice(0, 20);

  if (!clean || clean.length < 2) {
    return ["bromo_user_1", "bromo_user_2", "bromo_user_3"];
  }

  const candidates: string[] = [];
  const suffixes = [
    "",
    "_1",
    "_2",
    `_${Math.floor(Math.random() * 99)}`,
    `${Math.floor(Math.random() * 999)}`,
    "_official",
    `.${Math.floor(Math.random() * 9)}`,
  ];

  for (const suffix of suffixes) {
    const candidate = `${clean}${suffix}`;
    const validation = validateUsername(candidate);
    if (validation.valid) {
      candidates.push(candidate);
    }
    if (candidates.length >= count * 2) break;
  }

  const results: string[] = [];
  for (const c of candidates) {
    if (results.length >= count) break;
    if (await isUsernameAvailable(c)) {
      results.push(c);
    }
  }

  return results;
}
