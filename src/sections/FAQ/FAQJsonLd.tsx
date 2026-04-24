import { faqAnswerPlainText, faqDataLeft, faqDataRight } from './faqData';

/**
 * Faza 2.2 (Prompt 3): FAQPage schema.org — spójne z `faqData.ts` (jedno źródło prawdy).
 * RSC: trafia do <head> body stream jako sibling sekcji; Google rich results FAQ.
 */
export function FAQJsonLd() {
  const items = [...faqDataLeft, ...faqDataRight];
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqAnswerPlainText(item.a),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // JSON-LD: treść z JSON.stringify — bezpieczny escape; dane statyczne z repo
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
