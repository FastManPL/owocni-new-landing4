/**
 * RSC: lead + nagłówki kolumn FAQ — trafiają do HTML bez bundla GSAP.
 */
export function FAQLeadAndHeader() {
  return (
    <>
      <div className="faq-section-lead">
        <h2 className="faq-section-lead__title">
          <span className="faq-section-lead__strong">Budżety, z którymi pracujemy.</span>
          <span className="faq-section-lead__light">Dwa zespoły. Jeden standard.</span>
        </h2>
      </div>
      <div className="faq-header">
        <div className="faq-header-col">
          <h2>
            Realizacje
            <br />
            <span>strategiczne</span>
          </h2>
          <p>
            Rozwiązania dla firm, dla których strona to narzędzie wzrostu — Tworzy zespół z najdłuższym stażem.
            Spersonalizowaną ofertę budujemy po zdefiniowaniu 3 obszarów:
          </p>
          <div className="faq-price-row">
            <div className="faq-price-block">
              <strong>1. Zakres prac</strong>
            </div>
            <div className="faq-price-block">
              <strong>2. Poziom wykonania</strong>
            </div>
            <div className="faq-price-block">
              <strong>3. Tempo</strong>
            </div>
          </div>
        </div>
        <div className="faq-header-col">
          <h2>
            Mikro firmy,
            <br />
            <span>i małe projekty.</span>
          </h2>
          <p>
            Tworzymy świetną stronę i bierzemy ją pod stałą opiekę. Zdejmujemy Ci z głowy obowiązki związane z
            utrzymaniem. Kwestie techniczne i wdrażanie zmian masz w opiece.
          </p>
          <div className="faq-price-row">
            <div className="faq-price-block">
              <strong>Ceny od: 299zł /mc</strong>
              <small>dla subskrypcji– 36mcy.</small>
            </div>
            <div className="faq-price-block">
              <strong>ok: 9.420 zł / (Jednorazowo)</strong>
              <small>Bez subskrypcji.</small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
