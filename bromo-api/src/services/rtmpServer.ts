/**
 * RTMP / HLS live streaming server using node-media-server.
 *
 * Streamers push to:  rtmp://<host>:1935/live/<streamKey>
 * Viewers watch HLS:  http://<host>:8888/live/<streamKey>/index.m3u8
 *
 * The stream key is the user's MongoDB _id.
 */
import NodeMediaServer from "node-media-server";
import {emitLiveStart, emitLiveEnd} from "./socketService.js";
import path from "node:path";

const HLS_ROOT = path.resolve(process.cwd(), "live");
const RTMP_PORT = parseInt(process.env.RTMP_PORT ?? "1935", 10);
const HTTP_PORT = parseInt(process.env.RTMP_HTTP_PORT ?? "8888", 10);

const nmsConfig = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: HTTP_PORT,
    allow_origin: "*",
    mediaroot: HLS_ROOT,
  },
  trans: {
    ffmpeg: (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require("ffmpeg-static") as string;
      } catch {
        return "/usr/bin/ffmpeg";
      }
    })(),
    tasks: [
      {
        app: "live",
        hls: true,
        hlsFlags: "[hls_time=2:hls_list_size=3:hls_flags=delete_segments]",
        dash: false,
      },
    ],
  },
};

let nms: NodeMediaServer | null = null;

export function startRtmpServer(): void {
  if (nms) return;
  nms = new NodeMediaServer(nmsConfig);

  nms.on("prePublish", (_id: string, StreamPath: string) => {
    const streamKey = StreamPath.split("/").pop() ?? "";
    console.log(`[RTMP] Stream start: ${streamKey}`);
    emitLiveStart(streamKey, streamKey, "");
  });

  nms.on("donePublish", (_id: string, StreamPath: string) => {
    const streamKey = StreamPath.split("/").pop() ?? "";
    console.log(`[RTMP] Stream end: ${streamKey}`);
    emitLiveEnd(streamKey);
  });

  nms.run();
  console.log(`[RTMP] Server running — RTMP :${RTMP_PORT}, HLS :${HTTP_PORT}`);
}

export function getHlsUrl(streamKey: string, baseUrl: string): string {
  // Return the HLS manifest URL for viewers
  const host = baseUrl.replace(/:\d+$/, "");
  return `${host}:${HTTP_PORT}/live/${streamKey}/index.m3u8`;
}

export function getRtmpPushUrl(streamKey: string, host: string): string {
  return `rtmp://${host}:${RTMP_PORT}/live/${streamKey}`;
}
