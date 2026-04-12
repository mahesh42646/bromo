import {Router, type Response} from "express";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import {getHlsUrl, getRtmpPushUrl} from "../services/rtmpServer.js";
import {emitLiveStart, emitLiveEnd} from "../services/socketService.js";

export const liveRouter = Router();

type ActiveStream = {
  streamId: string;
  userId: string;
  displayName: string;
  profilePicture: string;
  title: string;
  viewerCount: number;
  startedAt: Date;
  hlsUrl: string;
};

// In-memory stream registry (replace with Redis in production)
const activeStreams = new Map<string, ActiveStream>();

// ── POST /live/start — register intent to go live, get RTMP push URL
liveRouter.post(
  "/start",
  requireVerifiedUser,
  (req: FirebaseAuthedRequest, res: Response) => {
    const user = req.dbUser!;
    const {title = ""} = req.body as {title?: string};

    const streamId = String(user._id);
    const proto = (Array.isArray(req.headers["x-forwarded-proto"])
      ? req.headers["x-forwarded-proto"][0]
      : req.headers["x-forwarded-proto"]) ?? req.protocol;
    const host = req.get("host")?.split(":")[0] ?? "localhost";
    const baseUrl = `${proto}://${host}`;

    const hlsUrl = getHlsUrl(streamId, baseUrl);
    const rtmpUrl = getRtmpPushUrl(streamId, host);

    const stream: ActiveStream = {
      streamId,
      userId: streamId,
      displayName: user.displayName,
      profilePicture: user.profilePicture ?? "",
      title,
      viewerCount: 0,
      startedAt: new Date(),
      hlsUrl,
    };
    activeStreams.set(streamId, stream);
    emitLiveStart(streamId, streamId, title);

    return res.json({streamId, rtmpUrl, hlsUrl, message: "Push RTMP stream to rtmpUrl to go live"});
  },
);

// ── POST /live/:streamId/end — broadcaster ends stream
liveRouter.post(
  "/:streamId/end",
  requireVerifiedUser,
  (req: FirebaseAuthedRequest, res: Response) => {
    const user = req.dbUser!;
    const {streamId} = req.params;
    if (String(user._id) !== streamId) {
      return res.status(403).json({message: "Not your stream"});
    }
    activeStreams.delete(streamId);
    emitLiveEnd(streamId);
    return res.json({message: "Stream ended"});
  },
);

// ── GET /live/active — list all active streams
liveRouter.get(
  "/active",
  requireFirebaseToken,
  (_req: FirebaseAuthedRequest, res: Response) => {
    return res.json({streams: Array.from(activeStreams.values())});
  },
);

// ── GET /live/:streamId — get single stream details + viewer HLS URL
liveRouter.get(
  "/:streamId",
  requireFirebaseToken,
  (req: FirebaseAuthedRequest, res: Response) => {
    const stream = activeStreams.get(String(req.params.streamId));
    if (!stream) return res.status(404).json({message: "Stream not found or ended"});
    return res.json({stream});
  },
);
