/**
 * Ścieżka bazowa aplikacji (subfolder na produkcji).
 * Next.js z unoptimized nie zawsze dopisuje basePath do src obrazków,
 * więc używaj getAssetPath() przy wszystkich assetach z public/.
 */
export const BASE_PATH = '';

export function getAssetPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${p}`;
}
