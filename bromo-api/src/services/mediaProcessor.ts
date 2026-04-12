import "../config/ffmpegInit.js";
import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import fs from "node:fs";
import { uploadsRoot } from "../utils/uploadFiles.js";

const UPLOAD_DIR = uploadsRoot();
const HLS_DIR = path.resolve(process.cwd(), "uploads", "hls");

if (!fs.existsSync(HLS_DIR)) {
  fs.mkdirSync(HLS_DIR, {recursive: true});
}

/**
 * Generate a thumbnail JPEG next to the video.
 * @param videoRelativePath POSIX path under `uploads/` (e.g. `userId/posts/abc.mp4`)
 * @returns POSIX relative path under `uploads/` for the thumbnail JPEG
 */
export async function generateVideoThumbnail(videoRelativePath: string): Promise<string> {
  const clean = videoRelativePath.replace(/^\/+/, "").split("/").join(path.sep);
  const videoPath = path.join(UPLOAD_DIR, clean);
  const outDir = path.dirname(videoPath);
  const thumbFilename = `thumb_${Date.now()}.jpg`;
  const thumbAbs = path.join(outDir, thumbFilename);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on("end", () => {
        const rel = path.relative(UPLOAD_DIR, thumbAbs).split(path.sep).join("/");
        resolve(rel);
      })
      .on("error", (err) => {
        console.error("[mediaProcessor] thumbnail error:", err.message);
        reject(err);
      })
      .screenshots({
        count: 1,
        timemarks: ["00:00:01.000"],
        filename: thumbFilename,
        folder: outDir,
        size: "720x?",
      });
  });
}

type HlsResult = {
  masterPlaylist: string;  // filename of master.m3u8
  variants: {bitrate: string; playlist: string}[];
};

/**
 * Transcode a video to HLS with 3 quality tiers:
 * 360p (800k), 720p (2500k), 1080p (5000k)
 * Returns relative paths for the master playlist.
 */
export async function transcodeToHls(videoFilename: string): Promise<HlsResult> {
  const clean = videoFilename.replace(/^\/+/, "").split("/").join(path.sep);
  const videoPath = path.join(UPLOAD_DIR, clean);
  const baseName = path.parse(clean).name;
  const hlsFolder = path.join(HLS_DIR, baseName);

  if (!fs.existsSync(hlsFolder)) {
    fs.mkdirSync(hlsFolder, {recursive: true});
  }

  const variants: HlsResult["variants"] = [
    {bitrate: "360p", playlist: `hls/${baseName}/360p.m3u8`},
    {bitrate: "720p", playlist: `hls/${baseName}/720p.m3u8`},
    {bitrate: "1080p", playlist: `hls/${baseName}/1080p.m3u8`},
  ];

  await Promise.all([
    transcodeVariant(videoPath, hlsFolder, "360p", 800, 360),
    transcodeVariant(videoPath, hlsFolder, "720p", 2500, 720),
    transcodeVariant(videoPath, hlsFolder, "1080p", 5000, 1080),
  ]);

  // Write master playlist
  const masterContent = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360`,
    `360p.m3u8`,
    `#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720`,
    `720p.m3u8`,
    `#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080`,
    `1080p.m3u8`,
  ].join("\n");

  const masterPath = path.join(hlsFolder, "master.m3u8");
  fs.writeFileSync(masterPath, masterContent);

  return {
    masterPlaylist: `hls/${baseName}/master.m3u8`,
    variants,
  };
}

function transcodeVariant(
  inputPath: string,
  outputFolder: string,
  label: string,
  bitrate: number,
  height: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=-2:${height}`,
        `-b:v ${bitrate}k`,
        `-maxrate ${Math.round(bitrate * 1.5)}k`,
        `-bufsize ${bitrate * 2}k`,
        `-hls_time 6`,
        `-hls_list_size 0`,
        `-hls_segment_filename ${path.join(outputFolder, `${label}_%03d.ts`)}`,
        `-preset veryfast`,
        `-movflags +faststart`,
        `-c:v libx264`,
        `-c:a aac`,
        `-ar 44100`,
      ])
      .output(path.join(outputFolder, `${label}.m3u8`))
      .on("end", () => resolve())
      .on("error", (err) => {
        console.error(`[mediaProcessor] HLS ${label} error:`, err.message);
        reject(err);
      })
      .run();
  });
}

/** Get video duration in seconds */
export async function getVideoDuration(videoFilename: string): Promise<number> {
  const clean = videoFilename.replace(/^\/+/, "").split("/").join(path.sep);
  const videoPath = path.join(UPLOAD_DIR, clean);
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 0);
    });
  });
}
