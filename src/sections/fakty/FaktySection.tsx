import { FaktySectionClientBoundary } from './FaktySectionClientBoundary';

/**
 * RSC entry: `<section id="fakty-section">` jest w `FaktyEngine` (client).
 * Tu tylko granica transferu chunka — bez zagnieżdżonego `<section>`.
 */
export function FaktySection() {
  return <FaktySectionClientBoundary />;
}
