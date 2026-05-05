import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

function firstExisting(paths: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const p of paths) {
    if (typeof p === "string" && p.trim() && fs.existsSync(p)) {
      out.push(p.trim());
    }
  }
  return out;
}

/** Resolve `ffmpeg` / `ffprobe` via shell when not at fixed paths (Docker, Nix, custom PATH). */
function resolveViaPath(command: "ffmpeg" | "ffprobe"): string | null {
  if (os.platform() === "win32") {
    const r = spawnSync("where", [command], { encoding: "utf-8", windowsHide: true });
    const line = r.stdout?.trim().split(/\r?\n/).filter(Boolean)[0];
    if (line && fs.existsSync(line)) return line;
    return null;
  }
  const r = spawnSync("/bin/sh", ["-lc", `command -v ${command}`], {
    encoding: "utf-8",
    windowsHide: true,
  });
  const line = r.stdout?.trim().split(/\r?\n/).filter(Boolean)[0];
  if (line && fs.existsSync(line)) return line;
  return null;
}

/**
 * Prefer a binary that actually runs (same arch, not a broken symlink).
 */
function firstRunnable(candidates: string[]): string | null {
  const seen = new Set<string>();
  for (const raw of candidates) {
    const bin = raw.trim();
    if (!bin || seen.has(bin)) continue;
    seen.add(bin);
    const r = spawnSync(bin, ["-version"], {
      encoding: "utf-8",
      windowsHide: true,
      timeout: 12_000,
    });
    if (r.status === 0) return bin;
  }
  return null;
}

function collectFfmpegCandidates(): string[] {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  const staticRaw = ffmpegStatic as unknown;
  const staticPath =
    typeof staticRaw === "string" && staticRaw.trim() ? staticRaw.trim() : "";
  const fixed = firstExisting([
    fromEnv,
    staticPath || null,
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "/snap/bin/ffmpeg",
  ]);
  const which = resolveViaPath("ffmpeg");
  const merged = [...fixed];
  if (which) merged.push(which);
  merged.push("ffmpeg");
  return merged;
}

function collectFfprobeCandidates(ffmpegBin: string | null): string[] {
  const fromEnv = process.env.FFPROBE_PATH?.trim();
  const fixed = firstExisting([
    fromEnv,
    "/usr/bin/ffprobe",
    "/usr/local/bin/ffprobe",
    "/opt/homebrew/bin/ffprobe",
    "/snap/bin/ffprobe",
  ]);
  const which = resolveViaPath("ffprobe");
  const merged = [...fixed];
  if (which) merged.push(which);
  merged.push("ffprobe");
  if (ffmpegBin && ffmpegBin !== "ffmpeg") {
    const probeSibling = ffmpegBin.replace(/ffmpeg$/i, "ffprobe");
    if (probeSibling !== ffmpegBin) merged.unshift(probeSibling);
  }
  return merged;
}

/**
 * Resolved ffmpeg binary for spawn / fluent-ffmpeg. Never null when any ffmpeg works on PATH.
 */
export const bundledFfmpegPath: string | null = firstRunnable(collectFfmpegCandidates());

if (bundledFfmpegPath) {
  ffmpeg.setFfmpegPath(bundledFfmpegPath);
} else {
  console.error(
    "[ffmpegInit] No working ffmpeg found. Set FFMPEG_PATH or install ffmpeg (e.g. apt install ffmpeg).",
  );
}

const ffprobeResolved = bundledFfmpegPath
  ? firstRunnable(collectFfprobeCandidates(bundledFfmpegPath))
  : firstRunnable(collectFfprobeCandidates(null));

if (ffprobeResolved) {
  ffmpeg.setFfprobePath(ffprobeResolved);
} else if (bundledFfmpegPath) {
  console.warn(
    "[ffmpegInit] ffprobe not found; duration probes may fail. Set FFPROBE_PATH or install ffmpeg (includes ffprobe).",
  );
}
