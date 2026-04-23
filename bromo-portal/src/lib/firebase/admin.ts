import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

let initialized = false;

function loadServiceAccount(): ServiceAccountJson | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!raw) return null;
  const abs = path.isAbsolute(raw)
    ? raw
    : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8")) as ServiceAccountJson;
  } catch {
    return null;
  }
}

/** Initialize Firebase Admin once when a valid service account file path is set. */
function ensureAdminApp(): void {
  if (initialized) return;
  const sa = loadServiceAccount();
  if (!sa?.private_key || !sa.client_email || !sa.project_id) return;
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
    });
  }
  initialized = true;
}

/**
 * When `FIREBASE_SERVICE_ACCOUNT_PATH` is set and readable, verifies the Firebase ID token
 * before calling Bromo API. If unset, verification is skipped (e.g. minimal CI).
 */
export async function verifyFirebaseIdTokenIfConfigured(idToken: string): Promise<boolean> {
  ensureAdminApp();
  if (!initialized) return true;
  try {
    await admin.auth().verifyIdToken(idToken);
    return true;
  } catch {
    return false;
  }
}
