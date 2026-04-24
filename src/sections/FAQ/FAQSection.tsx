import './faq-section.css';
import { FAQLeadAndHeader } from './FAQLeadAndHeader';
import { FAQSectionClient } from './FAQSectionClient';

/**
 * FAQ: RSC shell (lead + nagłówki w pierwszym HTML) + client engine (akordeon, ABC ST, popup).
 */
export default function FAQSection() {
  return (
    <section id="faq-section">
      <FAQLeadAndHeader />
      <FAQSectionClient />
    </section>
  );
}
