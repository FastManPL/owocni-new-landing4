'use client';

import { useEffect, useRef } from 'react';

interface UseAutoplayVideoOptions {
  threshold?: number; // What % of video should be visible to start playing (0-1)
}

export function useAutoplayVideo(options: UseAutoplayVideoOptions = {}) {
  const { threshold = 0.25 } = options;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              // Silently handle autoplay prevention
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold }
    );

    observer.observe(video);

    return () => observer.disconnect();
  }, [threshold]);

  return videoRef;
}
