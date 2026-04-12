import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import type { Request } from "express";
import type { FirebaseAuthedRequest } from "./firebaseAuth.js";
import { normalizeUploadCategory, uploadsRoot, type UploadCategory } from "../utils/uploadFiles.js";
import {
  extFromOriginalName,
  isBlockedExtension,
  normalizedMime,
  validateUploadForCategory,
} from "../utils/uploadPolicy.js";

const UPLOAD_DIR = uploadsRoot();
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXTS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".mp4",
  ".mov",
  ".m4v",
  ".3gp",
  ".webm",
  ".mkv",
  ".avi",
  ".mpeg",
  ".mpg",
  ".aac",
  ".m4a",
];

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
  "video/3gpp": ".3gp",
  "video/webm": ".webm",
  "video/x-matroska": ".mkv",
  "video/matroska": ".mkv",
  "video/x-msvideo": ".avi",
  "video/avi": ".avi",
  "video/mpeg": ".mpeg",
  "video/mp2t": ".mpeg",
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
};

function extFromMime(mime: string): string {
  return MIME_TO_EXT[normalizedMime(mime)] ?? "";
}

function randomName(ext: string): string {
  const suffix = randomBytes(8).toString("hex");
  return `${Date.now()}-${suffix}${ext}`;
}

function makeFileFilter(fixedCategory: UploadCategory | null) {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = extFromOriginalName(file.originalname);
    if (isBlockedExtension(ext)) {
      cb(new Error("This file type is blocked for security reasons."));
      return;
    }

    let resolvedExt = ext;
    if (!resolvedExt || !ALLOWED_EXTS.includes(resolvedExt)) {
      const fromMime = extFromMime(file.mimetype);
      if (fromMime && ALLOWED_EXTS.includes(fromMime)) resolvedExt = fromMime;
    }

    if (!resolvedExt || !ALLOWED_EXTS.includes(resolvedExt)) {
      const nm = normalizedMime(file.mimetype);
      if (nm.startsWith("video/")) {
        cb(new Error(`Unsupported video type (${nm}). Try MP4 or MOV.`));
        return;
      }
      if (nm.startsWith("image/")) {
        cb(new Error(`Unsupported image type (${nm}).`));
        return;
      }
      if (nm.startsWith("audio/")) {
        cb(new Error(`Unsupported audio type (${nm}).`));
        return;
      }
      const hint = ext || nm || "unknown";
      cb(new Error(`File type not supported (${hint})`));
      return;
    }

    const cat = fixedCategory ?? normalizeUploadCategory((req.query as { category?: string }).category);
    const policyErr = validateUploadForCategory(cat, file.mimetype, file.originalname || `upload${resolvedExt}`);
    if (policyErr) {
      cb(new Error(policyErr));
      return;
    }

    cb(null, true);
  };
}

function userScopedDestination(req: Request, category: UploadCategory): string {
  const fr = req as FirebaseAuthedRequest;
  const uid = fr.dbUser?._id;
  if (!uid) {
    throw new Error("User required for upload");
  }
  const dir = path.join(UPLOAD_DIR, String(uid), category);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveStoredExtension(file: Express.Multer.File): string {
  let ext = extFromOriginalName(file.originalname);
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    const fromMime = extFromMime(file.mimetype);
    if (fromMime && ALLOWED_EXTS.includes(fromMime)) ext = fromMime;
  }
  const nm = normalizedMime(file.mimetype);
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    if (nm.startsWith("video/")) return ".mp4";
    if (nm.startsWith("image/")) return ".jpg";
    if (nm.startsWith("audio/")) return ".m4a";
  }
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    return ".mp4";
  }
  return ext;
}

const storageGeneral = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const cat = normalizeUploadCategory((req.query as { category?: string }).category);
      cb(null, userScopedDestination(req, cat));
    } catch (e) {
      cb(e instanceof Error ? e : new Error("Upload failed"), UPLOAD_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = resolveStoredExtension(file);
    cb(null, randomName(ext));
  },
});

export const uploadSingle = multer({
  storage: storageGeneral,
  fileFilter: makeFileFilter(null),
  limits: { fileSize: 100 * 1024 * 1024 },
}).single("file");

const storageAvatar = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      cb(null, userScopedDestination(req, "profile"));
    } catch (e) {
      cb(e instanceof Error ? e : new Error("Upload failed"), UPLOAD_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = resolveStoredExtension(file);
    cb(null, `avatar_${randomName(ext)}`);
  },
});

export const uploadAvatar = multer({
  storage: storageAvatar,
  fileFilter: makeFileFilter("profile"),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("avatar");
