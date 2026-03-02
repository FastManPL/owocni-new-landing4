import 'server-only';
import { cache } from 'react';

export type Tier = 'S' | 'M' | 'L';

export interface Variant {
  slug: string;
  h1: string;
  sub: string;
  metaTitle?: string;
  metaDescription?: string;
}

const defaultVariant: Variant = {
  slug: 'default',
  h1: 'Tworzenie Stron Internetowych',
  sub: 'Strony WWW, które konwertują.',
  metaTitle: 'Tworzenie Stron Internetowych - Owocni',
  metaDescription: 'Profesjonalne tworzenie stron internetowych dla firm. Strony WWW, które konwertują.',
};

const VARIANTS: Record<string, Variant> = {
  default: defaultVariant,
};

function normalizeKey(value: unknown): string {
  if (value == null || typeof value !== 'string') return '';
  return value.toLowerCase().trim();
}

/**
 * F2/F3/F4/F10: getVariant z allowlisty, deterministyczna, React.cache() request-scoped.
 * ZAKAZ "use cache" na getVariant (DCI per request).
 * Caller w page.tsx: await searchParams, potem getVariant(params).
 */
export const getVariant = cache(function getVariant(
  searchParams: Record<string, string | string[] | undefined> = {}
): Variant {
  const raw = searchParams?.k ?? searchParams?.variant ?? searchParams?.v;
  const key = Array.isArray(raw) ? normalizeKey(raw[0]) : normalizeKey(raw);
  return VARIANTS[key] ?? defaultVariant;
});

/**
 * F7: autoTier(headline) — czysta funkcja serverowa.
 * Integrator przekazuje tier jako prop do sekcji; sekcja mapuje na CSS.
 */
export function autoTier(headline: string): Tier {
  const len = headline?.length ?? 0;
  if (len <= 25) return 'S';
  if (len <= 55) return 'M';
  return 'L';
}
