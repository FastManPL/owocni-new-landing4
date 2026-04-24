import type { CSSProperties } from 'react';
import { LOVE_WALL_REVIEWS_ROW1, LOVE_WALL_REVIEWS_ROW2 } from './loveWallReviewsData';

/**
 * Faza 2.1 (Prompt 3 / B1.1): treść opinii w initial HTML dla crawlerów.
 * `LoveWallSectionWrapper` ładuje silnik `ssr: false` — bez tego bloku opinie nie były w SSR.
 * Układ „sr-only” (clip) — bez wpływu na layout; duplikat wizualny ukryty.
 */
const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function LoveWallSeoQuotes() {
  const items = [...LOVE_WALL_REVIEWS_ROW1, ...LOVE_WALL_REVIEWS_ROW2];

  return (
    <aside
      id="love-wall-seo-quotes"
      aria-label="Opinie klientów"
      style={visuallyHidden}
    >
      <h2>Opinie klientów</h2>
      <ul>
        {items.map((r, i) => (
          <li key={`love-wall-seo-${r.author}-${i}`}>
            <figure>
              <blockquote>
                <p>{r.text}</p>
              </blockquote>
              <figcaption>
                <span>{r.author}</span>
                <img
                  src={r.avatar}
                  alt=""
                  width={27}
                  height={27}
                  loading="lazy"
                  decoding="async"
                />
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </aside>
  );
}
