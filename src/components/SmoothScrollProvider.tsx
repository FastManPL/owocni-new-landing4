'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { scrollRuntime } from '@/lib/scrollRuntime';

interface SmoothScrollProviderProps {
  children: ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  useEffect(() => {
    scrollRuntime.init();

    return () => {
      scrollRuntime.destroy();
    };
  }, []);

  return <>{children}</>;
}

export default SmoothScrollProvider;
