import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import type { Request } from "express";
import type { FirebaseAuthedRequest } from "./firebaseAuth.js";
import { normalizeUploadCategory, uploadsRoot, type UploadCategory } from "../utils/uploadFiles.js";

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
  "audio/aac": ".aac",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
};

function normalizedMime(mime: string): string {
  return mime.split(";")[0]?.trim().toLowerCase() ?? "";
}

function extFromMime(mime: string): string {
  return MIME_TO_EXT[normalizedMime(mime)] ?? "";
}

function randomName(ext: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
}

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext && ALLOWED_EXTS.includes(ext)) {
    cb(null, true);
    return;
  }
  const fromMime = extFromMime(file.mimetype);
  if (fromMime && ALLOWED_EXTS.includes(fromMime)) {
    cb(null, true);
    return;
  }
  const hint = ext || normalizedMime(file.mimetype) || "unknown";
  cb(new Error(`File type not supported (${hint})`));
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

/** General upload: query ?category=posts|reels|stories|public (default posts). Stored under uploads/{userId}/{category}/ */
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
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext || !ALLOWED_EXTS.includes(ext)) {
      const fromMime = extFromMime(file.mimetype);
      if (fromMime && ALLOWED_EXTS.includes(fromMime)) ext = fromMime;
    }
    if (!ext || !ALLOWED_EXTS.includes(ext)) {
      ext = ".jpg";
    }
    cb(null, randomName(ext));
  },
});

export const uploadSingle = multer({
  storage: storageGeneral,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).single("file");

/** Avatar: uploads/{userId}/profile/ */
const storageAvatar = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      cb(null, userScopedDestination(req, "profile"));
    } catch (e) {
      cb(e instanceof Error ? e : new Error("Upload failed"), UPLOAD_DIR);
    }
  },
  filename: (_req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext || !ALLOWED_EXTS.includes(ext)) {
      const fromMime = extFromMime(file.mimetype);
      if (fromMime && ALLOWED_EXTS.includes(fromMime)) ext = fromMime;
    }
    if (!ext || !ALLOWED_EXTS.includes(ext)) ext = ".jpg";
    cb(null, `avatar_${randomName(ext)}`);
  },
});

export const uploadAvatar = multer({
  storage: storageAvatar,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("avatar");
