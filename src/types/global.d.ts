import type { scrollRuntime } from '@/lib/scrollRuntime';

declare global {
  interface Window {
    __scroll?: typeof scrollRuntime;
  }
}

export {};
