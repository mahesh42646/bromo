import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
  path.resolve(__dirname, "../../firebase-service-account.json");

let initialized = false;

export function initFirebase(): void {
  if (initialized) return;

  if (fs.existsSync(serviceAccountPath)) {
    const raw = fs.readFileSync(serviceAccountPath, "utf-8");
    const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log("[firebase] Initialized with service account");
  } else {
    console.warn(
      `[firebase] Service account not found at ${serviceAccountPath}. ` +
        "Firebase features will fail until you place the file. " +
        "See FIREBASE_SETUP.md for instructions.",
    );
    admin.initializeApp();
    initialized = true;
  }
}

export function getAuth(): admin.auth.Auth {
  if (!initialized) initFirebase();
  return admin.auth();
}
