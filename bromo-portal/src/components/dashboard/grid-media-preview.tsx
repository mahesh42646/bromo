"use client";

import { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";
import { publicMediaUrl } from "@/lib/media-url";
import type { PortalPost } from "@/types/post";

function PosterVideo({ src, className }: { src: string; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    let cancelled = false;
    let hls: import("hls.js").default | null = null;

    const nudgeFrame = () => {
      if (cancelled || !video) return;
      try {
        video.muted = true;
        const d = video.duration;
        if (d && !Number.isNaN(d) && d > 0) {
          video.currentTime = Math.min(0.15, Math.max(0.02, d * 0.02));
        } else {
          video.currentTime = 0.08;
        }
      } catch {
        /* ignore */
      }
    };

    const onSeeked = () => {
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    };

    video.addEventListener("seeked", onSeeked);

    const run = async () => {
      if (src.includes(".m3u8") && video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener("loadeddata", nudgeFrame, { once: true });
        return;
      }
      if (src.includes(".m3u8")) {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ maxBufferLength: 10, maxMaxBufferLength: 20 });
          hls.on(Hls.Events.MANIFEST_PARSED, () => nudgeFrame());
          hls.loadSource(src);
          hls.attachMedia(video);
        } else {
          video.src = src;
          video.addEventListener("loadeddata", nudgeFrame, { once: true });
        }
        return;
      }
      video.src = src;
      video.addEventListener("loadeddata", nudgeFrame, { once: true });
    };

    void run();

    return () => {
      cancelled = true;
      hls?.destroy();
      video.removeEventListener("seeked", onSeeked);
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className={className}
      muted
      playsInline
      preload="auto"
      tabIndex={-1}
      aria-hidden
    />
  );
}

export function gridStreamUrl(post: Pick<PortalPost, "mediaUrl" | "hlsMasterUrl" | "mediaType">): string | null {
  if (post.mediaType !== "video") {
    const u = publicMediaUrl(post.mediaUrl);
    return u;
  }
  const hls = post.hlsMasterUrl?.trim();
  if (hls) return publicMediaUrl(hls);
  return publicMediaUrl(post.mediaUrl);
}

export function gridPosterUrl(post: Pick<PortalPost, "thumbnailUrl" | "mediaUrl" | "mediaType">): string | null {
  const t = post.thumbnailUrl?.trim();
  if (t) return publicMediaUrl(t);
  return null;
}

type GridMediaPreviewProps = {
  post: PortalPost;
  alt: string;
  className?: string;
};

export function GridMediaPreview({ post, alt, className = "size-full object-cover" }: GridMediaPreviewProps) {
  const [posterFailed, setPosterFailed] = useState(false);
  const stream = gridStreamUrl(post);
  const poster = gridPosterUrl(post);
  const isVideo = post.mediaType === "video";

  if (!isVideo) {
    const u = stream;
    if (!u) {
      return (
        <div className="flex size-full items-center justify-center bg-[var(--surface)] text-[var(--foreground-subtle)]">
          <Film className="size-8 opacity-40" />
        </div>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={u} alt={alt} className={className} />
    );
  }

  if (poster && !posterFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt={alt} className={className} onError={() => setPosterFailed(true)} />
    );
  }

  if (stream) {
    return <PosterVideo src={stream} className={className} />;
  }

  return (
    <div className="flex size-full items-center justify-center bg-[var(--surface)] text-[var(--foreground-subtle)]">
      <Film className="size-8 opacity-40" />
    </div>
  );
}
