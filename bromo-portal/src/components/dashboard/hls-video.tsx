"use client";

import { useEffect, useRef } from "react";

export function HlsVideo({
  src,
  className,
  muted,
}: {
  src: string;
  className?: string;
  muted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    let cancelled = false;
    let hls: import("hls.js").default | null = null;

    const run = async () => {
      const isHls = src.includes(".m3u8");
      if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        return;
      }
      if (isHls) {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.loadSource(src);
          hls.attachMedia(video);
        } else {
          video.src = src;
        }
        return;
      }
      video.src = src;
    };

    void run();
    return () => {
      cancelled = true;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return <video ref={ref} className={className} controls playsInline muted={muted} />;
}
