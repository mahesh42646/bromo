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

/** HLS rung definition */
type Rung = {
  height: number;
  videoBitrate: number;  // kbps
  audioBitrate: number;  // kbps
  maxRate: number;       // kbps (1.2× video for burst tolerance)
  bufsize: number;       // kbps (2× video)
};

const LADDER: Rung[] = [
  { height: 240,  videoBitrate: 400,  audioBitrate: 64,  maxRate: 480,  bufsize: 800  },
  { height: 360,  videoBitrate: 800,  audioBitrate: 96,  maxRate: 960,  bufsize: 1600 },
  { height: 480,  videoBitrate: 1400, audioBitrate: 128, maxRate: 1680, bufsize: 2800 },
  { height: 720,  videoBitrate: 2800, audioBitrate: 160, maxRate: 3360, bufsize: 5600 },
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

  // Duration
  const durM = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationSec = durM
    ? Number(durM[1]) * 3600 + Number(durM[2]) * 60 + Number(durM[3])
    : 0;

  // Video stream: "Video: codec, ..., WxH [..."
  const vidM = stderr.match(/Stream.*Video:\s*([a-zA-Z0-9_]+)[^,]*, (\d+)x(\d+)/);
  const width = vidM ? Number(vidM[2]) : 0;
  const height = vidM ? Number(vidM[3]) : 0;
  const videoCodec = vidM ? vidM[1].toLowerCase() : "h264";

  // FPS: "25 fps" or "29.97 tbr" etc.
  const fpsM = stderr.match(/(\d+(?:\.\d+)?)\s+(?:fps|tbr)/);
  const fps = fpsM ? Math.min(Number(fpsM[1]), 30) : 30;

  const hasAudio = /Stream.*Audio:/i.test(stderr);

  return { width, height, durationSec, fps, hasAudio, videoCodec };
}

/** Generate the ladder rungs that are ≤ source height and ≤ 1080. */
function selectRungs(sourceHeight: number): Rung[] {
  const cap = Math.min(sourceHeight, 1080);
  return LADDER.filter((r) => r.height <= cap);
}

/** Scale filter: fit height to target, preserve aspect, divisible by 2. */
function scaleFilter(targetHeight: number): string {
  return `scale=-2:${targetHeight}`;
}

/** Encode one HLS rung into outDir/H/. Returns segment dir. */
function encodeRung(
  inputAbs: string,
  outDir: string,
  rung: Rung,
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
        // HLS fMP4
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
      cmd.outputOptions(["-c:a aac", `-b:a ${rung.audioBitrate}k`, "-ac 2"]);
    } else {
      cmd.outputOptions(["-an"]);
    }

    cmd.save(playlistPath);
  });
}

/** Write master.m3u8 referencing variant playlists. */
function writeMasterPlaylist(outDir: string, rungs: Rung[]): void {
  const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:6", ""];
  for (const r of rungs) {
    const bandwidth = (r.videoBitrate + r.audioBitrate) * 1000;
    const resolution = `${Math.round((r.height * 16) / 9)}x${r.height}`;
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},CODECS="avc1.4D401F,mp4a.40.2"`);
    lines.push(`${r.height}/playlist.m3u8`);
  }
  fs.writeFileSync(path.join(outDir, "master.m3u8"), lines.join("\n"), "utf-8");
}

/** Write cellular-capped master (≤ 720p rungs only). */
function writeCellularMaster(outDir: string, rungs: Rung[]): void {
  const cellRungs = rungs.filter((r) => r.height <= 720);
  if (cellRungs.length === 0) return;
  const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:6", ""];
  for (const r of cellRungs) {
    const bandwidth = (r.videoBitrate + r.audioBitrate) * 1000;
    const resolution = `${Math.round((r.height * 16) / 9)}x${r.height}`;
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},CODECS="avc1.4D401F,mp4a.40.2"`);
    lines.push(`${r.height}/playlist.m3u8`);
  }
  fs.writeFileSync(path.join(outDir, "master_cell.m3u8"), lines.join("\n"), "utf-8");
}

export type HlsPackageResult = {
  /** Relative path to master.m3u8 (POSIX, under uploads/) */
  masterRelPath: string;
  /** Relative path to master_cell.m3u8 */
  cellMasterRelPath: string;
  renditions: Array<{ height: number; bitrate: number }>;
  probe: ProbeResult;
};

/**
 * Package a video file into multi-variant HLS.
 * @param rawRel - relative path of source file under uploads/
 * @param jobId  - job ID string used as output subdirectory name
 * @param onProgress - callback with 0–100 progress
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

  // Encode each rung sequentially (saves CPU vs parallel on small servers)
  for (let i = 0; i < rungs.length; i++) {
    onProgress?.(Math.round((i / rungs.length) * 85));
    try {
      await encodeRung(inputAbs, outDir, rungs[i], probe.fps, probe.hasAudio);
    } catch (fmp4Err) {
      // Fallback: retry with MPEG-TS segments if fMP4 fails (rare ffmpeg build issue)
      console.warn(`[hlsPackager] fMP4 failed for ${rungs[i].height}p, retrying with TS:`, fmp4Err);
      await encodeRungTs(inputAbs, outDir, rungs[i], probe.fps, probe.hasAudio);
    }
  }

  onProgress?.(90);
  writeMasterPlaylist(outDir, rungs);
  writeCellularMaster(outDir, rungs);
  onProgress?.(100);

  const hlsBase = `hls/${jobId}`;
  return {
    masterRelPath: `${hlsBase}/master.m3u8`,
    cellMasterRelPath: `${hlsBase}/master_cell.m3u8`,
    renditions: rungs.map((r) => ({ height: r.height, bitrate: r.videoBitrate })),
    probe,
  };
}

/** MPEG-TS fallback rung encoder */
function encodeRungTs(
  inputAbs: string,
  outDir: string,
  rung: Rung,
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
      cmd.outputOptions(["-c:a aac", `-b:a ${rung.audioBitrate}k`, "-ac 2"]);
    } else {
      cmd.outputOptions(["-an"]);
    }

    cmd.save(playlistPath);
  });
}
