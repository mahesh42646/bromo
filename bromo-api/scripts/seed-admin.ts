/**
 * Seed the first admin user using variables from `bromo-api/.env`.
 * Run from repo root: `npm run seed:admin`
 * (Do not use `node seed-admin.ts` — Node cannot execute TypeScript or resolve `.ts` via `.js` imports.)
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { Admin } from "../src/models/Admin.js";

async function run() {
  await mongoose.connect(env.mongoUri);
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@bromo.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!123";
  const name = process.env.SEED_ADMIN_NAME ?? "Super Admin";
  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log("Admin already exists:", email);
    await mongoose.disconnect();
    return;
  }
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  await Admin.create({
    email,
    passwordHash,
    name,
    role: "super_admin",
    isActive: true,
  });
  console.log("Seeded admin:", email, "(password from env or default)");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
