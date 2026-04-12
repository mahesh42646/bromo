import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
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

/** When clients send no extension (common on mobile), fall back to Content-Type. */
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext || !ALLOWED_EXTS.includes(ext)) {
      const fromMime = extFromMime(file.mimetype);
      if (fromMime && ALLOWED_EXTS.includes(fromMime)) ext = fromMime;
    }
    if (!ext || !ALLOWED_EXTS.includes(ext)) {
      ext = ".jpg";
    }
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});

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

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).single("file");

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("avatar");
