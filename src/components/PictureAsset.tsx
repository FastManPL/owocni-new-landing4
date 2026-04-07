'use client';

import { getAssetPath } from '@/lib/assetPath';

type PictureAssetProps = {
  /** Ścieżka bez rozszerzenia, np. `/assets/ptr` → ładuje `.avif` + `.webp` */
  stem: string;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  /** Opcjonalna klasa na `<picture>` (np. layout) */
  pictureClassName?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
};

/**
 * Natywne AVIF/WebP z public/ — bez `/_next/image` (brak podwójnej kompresji).
 */
export function PictureAsset({
  stem,
  alt = '',
  width,
  height,
  className,
  pictureClassName,
  sizes,
  loading = 'lazy',
  fetchPriority,
}: PictureAssetProps) {
  const avif = getAssetPath(`${stem}.avif`);
  const webp = getAssetPath(`${stem}.webp`);
  return (
    <picture className={pictureClassName}>
      <source srcSet={avif} type="image/avif" />
      <source srcSet={webp} type="image/webp" />
      <img
        src={webp}
        alt={alt}
        width={width}
        height={height}
        className={className}
        sizes={sizes}
        loading={loading}
        decoding="async"
        {...(fetchPriority ? { fetchPriority } : {})}
      />
    </picture>
  );
}
