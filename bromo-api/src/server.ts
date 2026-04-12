import "./config/ffmpegInit.js";
import {createServer} from "node:http";
import { createApp } from "./app.js";
import { connectDb } from "./db/connect.js";
import { env } from "./config/env.js";
import { initSocketServer } from "./services/socketService.js";
import { startRtmpServer } from "./services/rtmpServer.js";

async function main() {
  await connectDb();
  const app = createApp();

  // Wrap Express in an HTTP server so Socket.io can attach
  const httpServer = createServer(app);

  // Attach Socket.io
  initSocketServer(httpServer);

  // Start RTMP live streaming server on separate port
  try {
    startRtmpServer();
  } catch (err) {
    console.warn("[RTMP] Failed to start RTMP server (optional):", err);
  }

  httpServer.listen(env.port, () => {
    console.log(`BROMO API listening on https://bromo.darkunde.in:${env.port}`);
    console.log(`Socket.io ready on ws://0.0.0.0:${env.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
