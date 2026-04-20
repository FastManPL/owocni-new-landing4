'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { handoffChunkWarmupEntries } from '@/config/handoffChunkWarmup';
import { runWarmupPolicy } from '@/lib/moduleLoader';
import { scrollRuntime } from '@/lib/scrollRuntime';

interface SmoothScrollProviderProps {
  children: ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const pathname = usePathname();

  /** Handoff ma tylko `/` — idle prefetch Kinetic + Blok45 (jak na głównym LP). */
  useEffect(() => {
    if (pathname !== '/') return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) runWarmupPolicy(handoffChunkWarmupEntries);
    };
    let idleHandle: number | undefined;
    let timeoutId: number | undefined;
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(run, { timeout: 2800 });
    } else {
      timeoutId = window.setTimeout(run, 2800);
    }
    return () => {
      cancelled = true;
      if (
        idleHandle !== undefined &&
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
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
