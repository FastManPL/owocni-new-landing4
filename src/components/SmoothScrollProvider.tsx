'use client';

import { useEffect, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { scrollRuntime } from '@/lib/scrollRuntime';

interface SmoothScrollProviderProps {
  children: ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  useEffect(() => {
    let cancelled = false;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (!cancelled) scrollRuntime.init();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      scrollRuntime.destroy();
    };
  }, []);

  // orientationchange — szybki refresh od razu + drugi po ustabilizowaniu layoutu
  useLayoutEffect(() => {
    const handleOrientationChange = () => {
      scrollRuntime.requestRefreshImmediate();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollRuntime.requestRefresh('orientationchange-settle');
        });
      });
    };
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);

  return <>{children}</>;
}

export default SmoothScrollProvider;
