/**
 * Handoff: tylko chunki obecne w tej mini-apce (bez reszty home z głównego LP).
 * Spójne z ideą homeRouteChunkWarmup — ten sam moduleLoader + idle prefetch.
 */
import type { WarmupEntry } from '@/lib/moduleLoader';

export const handoffChunkWarmupEntries: WarmupEntry[] = [
  { policy: 'idle', import: () => import('@/sections/kinetic/KineticEngine') },
  { policy: 'idle', import: () => import('@/sections/block-45/Blok45Section') },
];
