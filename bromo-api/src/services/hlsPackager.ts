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
 * Optional HEVC (720p / 1080p only): ~62% of H.264 bandwidth estimate; skipped if libx265 fails.
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

  const vidM = stderr.match(/Stream.*Video:\s*([a-zA-Z0-9_]+)[^,]*, (\d+)x(\d+)/);
  const width = vidM ? Number(vidM[2]) : 0;
  const height = vidM ? Number(vidM[3]) : 0;
  const videoCodec = vidM ? vidM[1].toLowerCase() : "h264";

  const fpsM = stderr.match(/(\d+(?:\.\d+)?)\s+(?:fps|tbr)/);
  const fps = fpsM ? Math.min(Number(fpsM[1]), 30) : 30;

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
        "-preset veryfast",
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
      "-preset veryfast",
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
  for (let i = 0; i < n; i++) {
    onProgress?.(Math.round((i / n) * 70));
    try {
      await encodeRung(inputAbs, outDir, rungs[i], probe.fps, probe.hasAudio);
    } catch (fmp4Err) {
      console.warn(`[hlsPackager] fMP4 failed for ${rungs[i].height}p, retrying with TS:`, fmp4Err);
      await encodeRungTs(inputAbs, outDir, rungs[i], probe.fps, probe.hasAudio);
    }
  }

  const hevcHeights = new Set<number>();
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
        "-preset veryfast",
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
