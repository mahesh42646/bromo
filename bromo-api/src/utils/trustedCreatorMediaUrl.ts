import { uploadRelativePathFromUrl } from "./uploadFiles.js";

/** Creator KYC / document URLs must resolve to our uploads mirror (API CDN/S3 path includes `/uploads/`). */
export function assertTrustedCreatorMediaUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) return;
  const rel = uploadRelativePathFromUrl(trimmed);
  if (!rel) {
    throw new Error("Document URL must be an app upload (/uploads/…)");
  }
}
