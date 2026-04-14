/**
 * HLS Packager — multi-variant HLS ladder with fMP4 segments.
 *
 * Ladder (H.264, never upscale, max 1080p, 30 fps cap):
 *  240p  →  400 kbps video + 64 kbps audio
 *  360p  →  800 kbps video + 96 kbps audio
 *  480p  →  1400 kbps video + 128 kbps audio
 *  720p  →  2800 kbps video + 160 kbps audio
 *  1080p →  5000 kbps video + 192 kbps audio
 *
 * Optional HEVC (720p / 1080p only): opt-in via HLS_ENABLE_HEVC=1 (default off — saves ~half encode time on small hosts).
 * H.264 ladder: HLS_ENCODE_CONCURRENCY (default 2), HLS_X264_PRESET (default veryfast; ultrafast for max speed).
 *
 * Segments: ~2 s fMP4 (CMAF-style). Falls back to MPEG-TS if fmp4 fails.
 * Audio: AAC-LC stereo, bitrate scaled per rung.
 */

import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { bundledFfmpegPath } from "../config/ffmpegInit.js";
import { uploadsRoot } from "../utils/uploadFiles.js";

const UPLOAD_DIR = uploadsRoot();

function x264Preset(): string {
  const p = process.env.HLS_X264_PRESET?.trim().toLowerCase();
  const allowed = new Set([
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
  ]);
  if (p && allowed.has(p)) return p;
  return "veryfast";
}

function hlsEncodeConcurrency(): number {
  const raw = parseInt(process.env.HLS_ENCODE_CONCURRENCY ?? "2", 10);
  if (Number.isNaN(raw)) return 2;
  return Math.max(1, Math.min(4, raw));
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const capped = Math.max(1, Math.min(limit, items.length));
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: capped }, () => worker()));
}

/** HLS rung definition (exported for mezzanine encoder). */
export type HlsRung = {
  height: number;
  videoBitrate: number; // kbps
  audioBitrate: number; // kbps
  maxRate: number; // kbps (1.2× video for burst tolerance)
  bufsize: number; // kbps (2× video)
};

const LADDER: HlsRung[] = [
  { height: 240, videoBitrate: 400, audioBitrate: 64, maxRate: 480, bufsize: 800 },
  { height: 360, videoBitrate: 800, audioBitrate: 96, maxRate: 960, bufsize: 1600 },
  { height: 480, videoBitrate: 1400, audioBitrate: 128, maxRate: 1680, bufsize: 2800 },
  { height: 720, videoBitrate: 2800, audioBitrate: 160, maxRate: 3360, bufsize: 5600 },
  { height: 1080, videoBitrate: 5000, audioBitrate: 192, maxRate: 6000, bufsize: 10000 },
];

export type ProbeResult = {
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  hasAudio: boolean;
  videoCodec: string;
};

function absFromRel(rel: string): string {
  const clean = rel.replace(/^\/+/, "").split("/").join(path.sep);
  return path.join(UPLOAD_DIR, clean);
}

/** Even width for H.264/HEVC; height is the ladder rung height. */
export function displaySizeForRung(sourceW: number, sourceH: number, rungH: number): { w: number; h: number } {
  const h = rungH;
  const rawW = (sourceW * h) / sourceH;
  const w = Math.max(2, Math.round(rawW / 2) * 2);
  return { w, h };
}

/**
 * Parse ffmpeg -i stderr for the first video stream.
 * Resolution often appears *after* pixel-format commas, e.g.
 * `Video: h264 (...), yuv420p(...), 1080x1920` — a naive `codec, WxH` regex fails.
 */
function parseVideoStreamFromStderr(stderr: string): {
  width: number;
  height: number;
  videoCodec: string;
  fps: number;
} {
  let width = 0;
  let height = 0;
  let videoCodec = "h264";
  let fps = 30;

  const lineRe =
    /Stream\s+#\d+:\d+(?:\[[^\]]+])?(?:\([^)]*\))?:\s*Video:\s*([^\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(stderr)) !== null) {
    const rest = m[1].trim();
    const codecM = rest.match(/^([a-zA-Z0-9_-]+)/);
    if (codecM) videoCodec = codecM[1].toLowerCase();

    const dimMatches = [...rest.matchAll(/\b(\d{2,})x(\d{2,})\b/g)];
    for (const d of dimMatches) {
      const w = Number(d[1]);
      const h = Number(d[2]);
      if (w >= 16 && h >= 16 && w <= 8192 && h <= 8192) {
        width = w;
        height = h;
        break;
      }
    }

    const fpsLocal = rest.match(/(\d+(?:\.\d+)?)\s*(?:fps|tbr)\b/i);
    if (fpsLocal) fps = Math.min(Number(fpsLocal[1]), 30);

    if (width > 0 && height > 0) break;
  }

  if (width === 0 || height === 0) {
    const loose = stderr.match(/\b(\d{2,})x(\d{2,})\b/);
    if (loose) {
      width = Number(loose[1]);
      height = Number(loose[2]);
    }
  }

  return { width, height, videoCodec, fps };
}

/** Probe source file to get resolution, fps, duration. */
export function probeSource(absPath: string): ProbeResult {
  const bin = bundledFfmpegPath;
  if (!bin) throw new Error("ffmpeg binary not available");

  const r = spawnSync(bin, ["-hide_banner", "-i", absPath], {
    encoding: "utf-8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  const stderr = String(r.stderr ?? "");
  if (/No such file|Invalid data|moov atom not found/i.test(stderr)) {
    throw new Error(stderr.slice(0, 300));
  }

  const durM = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationSec = durM ? Number(durM[1]) * 3600 + Number(durM[2]) * 60 + Number(durM[3]) : 0;

  const { width, height, videoCodec, fps } = parseVideoStreamFromStderr(stderr);
  const hasAudio = /Stream.*Audio:/i.test(stderr);

  return { width, height, durationSec, fps, hasAudio, videoCodec };
}

function selectRungs(sourceHeight: number): HlsRung[] {
  const cap = Math.min(sourceHeight, 1080);
  return LADDER.filter((r) => r.height <= cap);
}

function scaleFilter(targetHeight: number): string {
  return `scale=-2:${targetHeight}`;
}

function encodeRung(
  inputAbs: string,
  outDir: string,
  rung: HlsRung,
  fps: number,
  hasAudio: boolean,
): Promise<void> {
  const rungDir = path.join(outDir, String(rung.height));
  fs.mkdirSync(rungDir, { recursive: true });

  const segPattern = path.join(rungDir, "seg_%03d.m4s");
  const playlistPath = path.join(rungDir, "playlist.m3u8");

  return new Promise((resolve, reject) => {
    const targetFps = Math.min(fps, 30);
    const cmd = ffmpeg(inputAbs)
      .outputOptions([
        "-c:v libx264",
        `-preset ${x264Preset()}`,
        "-profile:v main",
        "-level 3.1",
        `-vf ${scaleFilter(rung.height)},fps=${targetFps}`,
        `-b:v ${rung.videoBitrate}k`,
        `-maxrate ${rung.maxRate}k`,
        `-bufsize ${rung.bufsize}k`,
        "-pix_fmt yuv420p",
        "-hls_time 2",
        "-hls_playlist_type vod",
        "-hls_segment_type fmp4",
        `-hls_segment_filename ${segPattern}`,
        "-hls_flags independent_segments",
        "-movflags frag_keyframe+empty_moov+default_base_moof",
      ])
      .on("end", () => resolve())
      .on("error", (e) => reject(e));

    if (hasAudio) {
      cmd.outputOptions(["-c:a", "aac", "-b:a", `${rung.audioBitrate}k`, "-ac", "2"]);
    } else {
      cmd.outputOptions(["-an"]);
    }

    cmd.save(playlistPath);
  });
}

/** HEVC variant in `<height>_hevc/` for720p and 1080p ladder rungs. */
function encodeHevcRung(
  inputAbs: string,
  outDir: string,
  rung: HlsRung,
  fps: number,
  hasAudio: boolean,
): Promise<void> {
  const rungDir = path.join(outDir, `${rung.height}_hevc`);
  fs.mkdirSync(rungDir, { recursive: true });

  const segPattern = path.join(rungDir, "seg_%03d.m4s");
  const playlistPath = path.join(rungDir, "playlist.m3u8");
  const vBit = Math.max(200, Math.round(rung.videoBitrate * 0.68));
  const maxR = Math.round(rung.maxRate * 0.68);
  const buf = Math.round(rung.bufsize * 0.68);

  return new Promise((resolve, reject) => {
    const targetFps = Math.min(fps, 30);
    const cmd = ffmpeg(inputAbs)
      .outputOptions([
        "-c:v libx265",
        "-preset fast",
        "-tag:v hvc1",
        `-vf ${scaleFilter(rung.height)},fps=${targetFps}`,
        `-b:v ${vBit}k`,
        `-maxrate ${maxR}k`,
        `-bufsize ${buf}k`,
        "-pix_fmt yuv420p",
        "-hls_time 2",
        "-hls_playlist_type vod",
        "-hls_segment_type fmp4",
        `-hls_segment_filename ${segPattern}`,
        "-hls_flags independent_segments",
        "-movflags frag_keyframe+empty_moov+default_base_moof",
      ])
      .on("end", () => resolve())
      .on("error", (e) => reject(e));

    if (hasAudio) {
      cmd.outputOptions(["-c:a", "aac", "-b:a", `${rung.audioBitrate}k`, "-ac", "2"]);
    } else {
      cmd.outputOptions(["-an"]);
    }

    cmd.save(playlistPath);
  });
}

function hevcStreamBandwidth(rung: HlsRung): number {
  const vBit = Math.max(200, Math.round(rung.videoBitrate * 0.68));
  return (vBit + rung.audioBitrate) * 1000;
}

function writeMasterPlaylist(outDir: string, rungs: HlsRung[], probe: ProbeResult, hevcHeights: Set<number>): void {
  const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:6", ""];
  for (const r of rungs) {
    const { w, h } = displaySizeForRung(probe.width, probe.height, r.height);
    const bandwidth = (r.videoBitrate + r.audioBitrate) * 1000;
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${w}x${h},CODECS="avc1.4D401F,mp4a.40.2"`,
    );
    lines.push(`${r.height}/playlist.m3u8`);
  }
  for (const r of rungs) {
    if (r.height < 720 || !hevcHeights.has(r.height)) continue;
    const { w, h } = displaySizeForRung(probe.width, probe.height, r.height);
    const bandwidth = hevcStreamBandwidth(r);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${w}x${h},CODECS="hvc1.1.6.L93.B0,mp4a.40.2"`,
    );
    lines.push(`${r.height}_hevc/playlist.m3u8`);
  }
  fs.writeFileSync(path.join(outDir, "master.m3u8"), lines.join("\n"), "utf-8");
}

function writeCellularMaster(outDir: string, rungs: HlsRung[], probe: ProbeResult, hevcHeights: Set<number>): void {
  const cellRungs = rungs.filter((r) => r.height <= 720);
  if (cellRungs.length === 0) return;
  const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:6", ""];
  for (const r of cellRungs) {
    const { w, h } = displaySizeForRung(probe.width, probe.height, r.height);
    const bandwidth = (r.videoBitrate + r.audioBitrate) * 1000;
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${w}x${h},CODECS="avc1.4D401F,mp4a.40.2"`,
    );
    lines.push(`${r.height}/playlist.m3u8`);
  }
  for (const r of cellRungs) {
    if (!hevcHeights.has(r.height)) continue;
    const { w, h } = displaySizeForRung(probe.width, probe.height, r.height);
    const bandwidth = hevcStreamBandwidth(r);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${w}x${h},CODECS="hvc1.1.6.L93.B0,mp4a.40.2"`,
    );
    lines.push(`${r.height}_hevc/playlist.m3u8`);
  }
  fs.writeFileSync(path.join(outDir, "master_cell.m3u8"), lines.join("\n"), "utf-8");
}

export type HlsPackageResult = {
  masterRelPath: string;
  cellMasterRelPath: string;
  renditions: Array<{ height: number; bitrate: number }>;
  probe: ProbeResult;
  rungs: HlsRung[];
};

/**
 * Single progressive H.264 MP4 (faststart), top rung resolution — fallback / download URI.
 */
export async function encodeMezzanineMp4(
  rawRel: string,
  jobId: string,
  probe: ProbeResult,
  rungs: HlsRung[],
): Promise<string> {
  if (rungs.length === 0) throw new Error("No rungs for mezzanine");
  const inputAbs = absFromRel(rawRel);
  const top = rungs[rungs.length - 1]!;
  const outDir = path.join(UPLOAD_DIR, "hls", jobId);
  fs.mkdirSync(outDir, { recursive: true });
  const outAbs = path.join(outDir, "mezzanine.mp4");
  const targetFps = Math.min(probe.fps, 30);

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputAbs).outputOptions([
      "-c:v libx264",
      `-preset ${x264Preset()}`,
      "-profile:v high",
      "-level 4.1",
      `-vf ${scaleFilter(top.height)},fps=${targetFps}`,
      `-b:v ${top.videoBitrate}k`,
      `-maxrate ${top.maxRate}k`,
      `-bufsize ${top.bufsize}k`,
      "-pix_fmt yuv420p",
      "-movflags +faststart",
    ]);

    if (probe.hasAudio) {
      cmd.outputOptions(["-c:a", "aac", "-b:a", `${top.audioBitrate}k`, "-ac", "2"]);
    } else {
      cmd.outputOptions(["-an"]);
    }

    cmd
      .on("end", () => resolve(`hls/${jobId}/mezzanine.mp4`))
      .on("error", (e) => reject(e))
      .save(outAbs);
  });
}

/**
 * Package a video file into multi-variant HLS (+ optional HEVC for 720/1080).
 */
export async function packageHls(
  rawRel: string,
  jobId: string,
  onProgress?: (pct: number) => void,
): Promise<HlsPackageResult> {
  const inputAbs = absFromRel(rawRel);
  const probe = probeSource(inputAbs);

  if (probe.height === 0 || probe.width === 0) {
    throw new Error("Could not determine source resolution — is this a valid video?");
  }

  const rungs = selectRungs(probe.height);
  if (rungs.length === 0) {
    throw new Error(`No valid rungs for source height ${probe.height}`);
  }

  const outDir = path.join(UPLOAD_DIR, "hls", jobId);
  fs.mkdirSync(outDir, { recursive: true });

  const n = rungs.length;
  let h264Done = 0;
  await runWithConcurrency(rungs, hlsEncodeConcurrency(), async (rung) => {
    try {
      await encodeRung(inputAbs, outDir, rung, probe.fps, probe.hasAudio);
    } catch (fmp4Err) {
      console.warn(`[hlsPackager] fMP4 failed for ${rung.height}p, retrying with TS:`, fmp4Err);
      await encodeRungTs(inputAbs, outDir, rung, probe.fps, probe.hasAudio);
    }
    h264Done++;
    onProgress?.(Math.round((h264Done / n) * 70));
  });

  const hevcHeights = new Set<number>();
  if (process.env.HLS_ENABLE_HEVC === "1") {
    for (const r of rungs) {
      if (r.height < 720) continue;
      try {
        onProgress?.(72);
        await encodeHevcRung(inputAbs, outDir, r, probe.fps, probe.hasAudio);
        hevcHeights.add(r.height);
      } catch (e) {
        console.warn(`[hlsPackager] HEVC ${r.height}p skipped:`, e);
      }
    }
  }

  onProgress?.(88);
  writeMasterPlaylist(outDir, rungs, probe, hevcHeights);
  writeCellularMaster(outDir, rungs, probe, hevcHeights);
  /** Leave headroom for mezzanine MP4 in worker (90–100). */
  onProgress?.(90);

  const hlsBase = `hls/${jobId}`;
  return {
    masterRelPath: `${hlsBase}/master.m3u8`,
    cellMasterRelPath: `${hlsBase}/master_cell.m3u8`,
    renditions: rungs.map((r) => ({ height: r.height, bitrate: r.videoBitrate })),
    probe,
    rungs,
  };
}

function encodeRungTs(
  inputAbs: string,
  outDir: string,
  rung: HlsRung,
  fps: number,
  hasAudio: boolean,
): Promise<void> {
  const rungDir = path.join(outDir, String(rung.height));
  fs.mkdirSync(rungDir, { recursive: true });

  const segPattern = path.join(rungDir, "seg_%03d.ts");
  const playlistPath = path.join(rungDir, "playlist.m3u8");

  return new Promise((resolve, reject) => {
    const targetFps = Math.min(fps, 30);
    const cmd = ffmpeg(inputAbs)
      .outputOptions([
        "-c:v libx264",
        `-preset ${x264Preset()}`,
        "-profile:v main",
        "-level 3.1",
        `-vf ${scaleFilter(rung.height)},fps=${targetFps}`,
        `-b:v ${rung.videoBitrate}k`,
        `-maxrate ${rung.maxRate}k`,
        `-bufsize ${rung.bufsize}k`,
        "-pix_fmt yuv420p",
        "-hls_time 2",
        "-hls_playlist_type vod",
        "-hls_segment_type mpegts",
        `-hls_segment_filename ${segPattern}`,
        "-hls_flags independent_segments",
      ])
      .on("end", () => resolve())
      .on("error", (e) => reject(e));

    if (hasAudio) {
      cmd.outputOptions(["-c:a", "aac", "-b:a", `${rung.audioBitrate}k`, "-ac", "2"]);
    } else {
      cmd.outputOptions(["-an"]);
    }

    cmd.save(playlistPath);
  });
}
