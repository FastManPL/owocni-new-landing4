'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { homeRouteChunkWarmupEntries } from '@/config/homeRouteChunkWarmup';
import { runWarmupPolicy } from '@/lib/moduleLoader';
import { scrollRuntime } from '@/lib/scrollRuntime';

interface SmoothScrollProviderProps {
  children: ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const pathname = usePathname();

  /** Home: idle prefetch chunków zgodnych z `page.tsx` (cache `moduleLoader` — bez podwójnej pracy po mount). */
  useEffect(() => {
    if (pathname !== '/') return;
    const id = requestIdleCallback(
      () => {
        runWarmupPolicy(homeRouteChunkWarmupEntries);
      },
      { timeout: 2800 }
    );
    return () => cancelIdleCallback(id);
  }, [pathname]);

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
