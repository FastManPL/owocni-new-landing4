import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // === CORE ===
  cacheComponents: true,
  reactStrictMode: true,
  poweredByHeader: false,

  transpilePackages: ['@owocni/cennik-form'],

  /** Tree-shaking / deduplikacja importów z „barrel-heavy” paczek (Konstytucja H8). */
  experimental: {
    optimizePackageImports: ['gsap'],
  },

  // === REACT COMPILER (A6) ===
  reactCompiler: {
    compilationMode: 'annotation',
  },

  // === IMAGES (G15) ===
  images: {
    deviceSizes: [360, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    qualities: [60, 75, 85],
    formats: ['image/avif', 'image/webp'],
  },

  // === TYPESCRIPT ===
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withBundleAnalyzer(nextConfig);
