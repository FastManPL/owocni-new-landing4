// @ts-nocheck — przeniesiony ze stagingu; pełne dopasowanie do strict TS = osobna refaktoryzacja
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import './FormCore.css';

// ============================================================================
// FORMULARZ OWOCNI - 4 PRODUKTY
// ============================================================================

interface OwocniFormProps {
  initialProduct?: 'strony' | 'logo' | 'nazwy' | 'marketing' | null;
  /** true = karta w LP (#final-formCard): bez 100vh / cienia z wrappera */
  embed?: boolean;
}

const OwocniForm = ({ initialProduct = null, embed = false }: OwocniFormProps = {}) => {
  // === STATE ===
  const [currentProduct, setCurrentProduct] = useState<string | null>(initialProduct || null); // null = cennik
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [selectedCennik, setSelectedCennik] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const [ctaAnimating, setCtaAnimating] = useState(false);
  const [showMailing, setShowMailing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mailingAnimated, setMailingAnimated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | boolean | null>>({});
  const [validFields, setValidFields] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [descriptionHintVisible, setDescriptionHintVisible] = useState(false);

  const transitionLayerRef = useRef<HTMLDivElement>(null);
  const ctaButtonRef = useRef<HTMLButtonElement>(null);
  const startTimeRef = useRef(Date.now());

  // === CONFIG ===
  const CONFIG = {
    autoAdvanceDelay: 80,
    minSubmitTime: 800,
    minDescriptionWords: 10,
  };

  // === FORM SUBMIT URL ===
  // Domyślnie ten sam host: POST /api/cennik (Route Handler w App Router).
  // Opcjonalnie: NEXT_PUBLIC_FORM_SUBMIT_URL — tylko jeśli musisz przełączyć na inny path.
  const FORM_SUBMIT_URL =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_FORM_SUBMIT_URL || '/api/cennik')
      : '/api/cennik';

  /** Strony „dziękujemy” z formularza — zawsze absolutny URL (host staging / override przez NEXT_PUBLIC_THANKYOU_ORIGIN). */
  const thankYouOrigin = (
    process.env.NEXT_PUBLIC_THANKYOU_ORIGIN || 'https://owocni-staging.vercel.app'
  ).replace(/\/$/, '');

  // === PRODUCT DEFINITIONS ===
  const PRODUCTS: Record<string, any> = {
    strony: {
      name: 'strony_owocni',
      hasMailing: true,
      steps: [
        {
          name: 'strona_jaka',
          type: 'product-card',
          title: 'Jaką stronę chcesz wycenić?',
          subtitle: 'Wybierz jedną z dwóch opcji i odbierz niezobowiązującą wycenę.',
          options: [
            { value: 'premium', title: 'Ważna strona', desc: 'Aktywnie zdobywa klientów.', badge: 'Wycena z pomocą eksperta' },
            { value: 'basic', title: 'Strona wizytówka', desc: 'Informacyjna, kilka zakładek.', badge: 'Wycena z cennika' },
          ],
          autoAdvance: true,
          progress: 0,
        },
        {
          name: 'strona_model',
          type: 'radio',
          title: 'Jaki masz typ działalności?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'b2b', label: '<strong>B2B</strong> – Moimi klientami są firmy' },
            { value: 'local', label: '<strong>Firma lokalna</strong> – Klienci z okolicy' },
            { value: 'ecommerce', label: '<strong>Sklep internetowy</strong> – eCommerce' },
            { value: 'online', label: '<strong>Online</strong> – Klienci z całej sieci' },
          ],
          autoAdvance: true,
          progress: 50,
        },
        {
          name: 'strona_ma',
          type: 'radio-expandable',
          title: 'Czy firma ma już stronę?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'existing', label: '<strong>Tak</strong> – To kolejny etap rozwoju.', expandable: true },
            { value: 'new', label: '<strong>Nie</strong> – To nowa firma i pierwsza strona.', expandable: false },
          ],
          expandField: {
            name: 'currentWww',
            label: 'Wpisz adres www strony',
            errorText: 'Podaj poprawny adres (np. firma.pl)',
          },
          cta: 'Dalej (Prawie koniec)',
          progress: 75,
        },
        {
          name: 'strona_cena',
          type: 'radio',
          title: 'Jaki masz budżet?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: '4-10k', label: '4.000 - 10.000 zł — Strona na start' },
            { value: '10-25k', label: '10.000 - 25.000 zł — Standard' },
            { value: '25k+', label: 'pow. 25.000 zł — Rozwiązania Premium' },
            { value: 'unknown', label: 'Nie znam stawek — Dajcie rekomendację' },
          ],
          autoAdvance: true,
          conditional: (ans: Record<string, any>) => ans.strona_jaka === 'basic' && ans.strona_ma === 'new',
          progress: 75,
        },
        {
          name: 'strona_opis',
          type: 'textarea',
          title: 'Opisz firmę i potrzeby strony',
          subtitle: 'Wpisz pomysły i wszystkie usługi/produkty.',
          placeholder: 'Np. Potrzebuję galerii, kalkulatora, automatyzacji wycen – doradźcie, co działa! W ofercie mamy...',
          errorText: '10 słów do wyceny ➔ Bez „to zależy"',
          hint: '🏆 <b>Dobry początek, ale potrzebujemy detali.</b><br>Opisz swoją ofertę i plany dokładniej, by otrzymać trafną wycenę i dopasowane przykłady.',
          microcopy: '💡 Więcej szczegółów = Wycena 24h, <strong>bez widełek.</strong>',
          cta: 'Koniec >',
          progress: 95,
        },
        {
          name: 'contact',
          type: 'contact',
          title: '<span class="title-tight"><span class="text-shine">Udało się!</span> Składamy opcje cenowe</span>',
          subtitle: 'Komu mamy je wysłać?',
          cta: 'Wyślijcie mi propozycje',
          progress: 100,
        },
      ],
      mailingVariants: {
        'b2b': {
          title: 'Akcelerator<br>strony B2B',
          subtitle: 'Dołączyć Ci <strong>bezpłatne materiały</strong>, dzięki którym podwoisz efektywność strony w zdobywaniu nowych klientów biznesowych?'
        },
        'local': {
          title: 'Akcelerator strony<br>dla firmy lokalnej',
          subtitle: 'Dołączyć Ci <strong>bezpłatne materiały</strong>, dzięki którym podwoisz efektywność strony w zdobywaniu nowych klientów z okolicy?'
        },
        'ecommerce': {
          title: 'Akcelerator<br>sklepu eCommerce',
          subtitle: 'Dołączyć Ci <strong>bezpłatne materiały</strong>, dzięki którym podwoisz efektywność sklepu w zdobywaniu nowych klientów?'
        },
        'online': {
          title: 'Akcelerator stron dla firm<br>o zasięgu ogólnopolskim',
          subtitle: 'Dołączyć Ci <strong>bezpłatne materiały</strong>, dzięki którym podwoisz efektywność strony w zdobywaniu nowych klientów z sieci?'
        }
      },
    },
    logo: {
      name: 'logo_owocni',
      hasMailing: false,
      steps: [
        {
          name: 'logo_jakie',
          type: 'product-card',
          title: 'Jaki projekt chcesz wycenić?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'basic', title: 'Projekt Logo', desc: 'Niezbędne minimum na start', badge: 'Wycena z cennika' },
            { value: 'premium', title: 'Projekt kompletnej marki', desc: 'Narzędzia rozpoznawalności', badge: 'Wycena z pomocą eksperta' },
          ],
          autoAdvance: true,
          progress: 0,
        },
        {
          name: 'logo_ma',
          type: 'radio',
          title: 'Czy firma ma już logo?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'new', label: '<strong>Nie</strong> – To nowy biznes, pierwsze logo' },
            { value: 'existing', label: '<strong>Tak</strong> – Rozwijamy firmę, zmieniamy logo' },
          ],
          autoAdvance: true,
          progress: 50,
        },
        {
          name: 'logo_strona',
          type: 'radio',
          title: 'Myślisz o stronie www?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'tak', label: '<strong>Tak</strong> – Wyceńcie to w pakiecie' },
            { value: 'myslimy', label: '<strong>Myślimy</strong> – Podeślijcie przykłady' },
            { value: 'nie', label: '<strong>Może kiedyś</strong> – Teraz tylko logo' },
          ],
          autoAdvance: true,
          progress: 75,
        },
        {
          name: 'logo_opis',
          type: 'textarea',
          title: 'Napisz coś o tym projekcie',
          subtitle: 'Więcej wiemy = lepiej się dopasujemy',
          placeholder: 'Np. Czym się zajmujesz? Chodzi Ci po głowie jakiś pomysł?',
          errorText: '10 słów do wyceny ➔ Bez „to zależy"',
          hint: '🏆 <b>Dobry początek, ale potrzebujemy detali.</b><br>Opisz swoją ofertę i plany dokładniej, by otrzymać trafną wycenę i dopasowane przykłady.',
          microcopy: '💡 Więcej szczegółów = Wycena 24h, <strong>bez widełek.</strong>',
          cta: 'Koniec >',
          progress: 95,
        },
        {
          name: 'contact',
          type: 'contact',
          title: '<span class="title-tight"><span class="text-shine">Udało się!</span> Składamy opcje cenowe</span>',
          subtitle: 'Komu mamy je wysłać?',
          cta: 'Wyślijcie mi propozycje',
          progress: 100,
        },
      ],
    },
    nazwy: {
      name: 'nazwa_owocni',
      hasMailing: false,
      steps: [
        {
          name: 'nazwa_jaka',
          type: 'product-card',
          title: 'Jaką nazwę chcesz wycenić?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'basic', title: 'Nazwa dla małej firmy', desc: 'Niezbędne minimum na start', badge: 'Wycena z cennika' },
            { value: 'premium', title: 'Naming strategiczny', desc: 'Weryfikacja prawna — Rejestracja', badge: 'Wycena z pomocą eksperta' },
          ],
          autoAdvance: true,
          progress: 0,
        },
        {
          name: 'nazwa_domena',
          type: 'radio',
          title: 'Preferowany adres www?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'pl', label: '<strong>PL</strong> – polski adres strony' },
            { value: 'com', label: '<strong>COM</strong> – międzynarodowy adres strony' },
            { value: 'inne', label: '<strong>Inne / kreatywne</strong> – .eu, .ai, .io' },
            { value: 'brak', label: '<strong>Brak wymagań</strong> – doradźcie mi' },
          ],
          autoAdvance: true,
          progress: 50,
        },
        {
          name: 'nazwa_strona',
          type: 'radio',
          title: 'Myślisz o stronie www?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'tak', label: '<strong>Tak</strong> – wyceńcie to w pakiecie' },
            { value: 'myslimy', label: '<strong>Myślimy</strong> – podeślijcie przykłady' },
            { value: 'nie', label: '<strong>Może kiedyś</strong> – teraz tylko nazwa' },
          ],
          autoAdvance: true,
          progress: 75,
        },
        {
          name: 'nazwa_opis',
          type: 'textarea',
          title: 'Napisz coś o tym projekcie',
          subtitle: 'Więcej wiemy = lepiej się dopasujemy',
          placeholder: 'Np. Czym się zajmujesz? Chodzi Ci po głowie jakiś pomysł?',
          errorText: '10 słów do wyceny ➔ Bez „to zależy"',
          hint: '🏆 <b>Dobry początek, ale potrzebujemy detali.</b><br>Opisz swoją ofertę i plany dokładniej, by otrzymać trafną wycenę i dopasowane przykłady.',
          microcopy: '💡 Więcej szczegółów = Wycena 24h, <strong>bez widełek.</strong>',
          cta: 'Koniec >',
          progress: 95,
        },
        {
          name: 'contact',
          type: 'contact',
          title: '<span class="title-tight"><span class="text-shine">Udało się!</span> Składamy opcje cenowe</span>',
          subtitle: 'Komu mamy je wysłać?',
          cta: 'Wyślijcie mi propozycje',
          progress: 100,
        },
      ],
    },
    marketing: {
      name: 'marketing_owocni',
      hasMailing: false,
      steps: [
        {
          name: 'marketing_etap',
          type: 'radio',
          title: 'Na jakim etapie jest Twój biznes?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'startup', label: '<strong>Startuję</strong> — Dopiero badam możliwości' },
            { value: 'stable', label: '<strong>Stabilizuję</strong> — Tworzę procesy pod wzrost' },
            { value: 'scale', label: '<strong>Skaluję</strong> — Szukam nowych kanałów' },
            { value: 'optimize', label: '<strong>Optymalizuję</strong> — Chcę lepszy zwrot (ROI)' },
          ],
          autoAdvance: true,
          progress: 0,
        },
        {
          name: 'marketing_cel',
          type: 'radio',
          title: 'Jaki jest Twój główny cel?',
          subtitle: 'Wybierz jedną z opcji',
          options: [
            { value: 'ceny', label: '<strong>Chcę podnieść ceny</strong>' },
            { value: 'klienci', label: '<strong>Zdobyć więcej klientów</strong>' },
            { value: 'koszt', label: '<strong>Obniżyć koszt pozyskania klienta</strong>' },
            { value: 'wszystko', label: '<strong>Wszystkie powyższe</strong>' },
          ],
          autoAdvance: true,
          progress: 50,
        },
        {
          name: 'marketing_inwestycja',
          type: 'radio',
          title: 'Ile inwestujesz w miesiącu<br>w pozyskiwanie klientów?',
          subtitle: 'Lub ile planujesz inwestować?',
          options: [
            { value: '0-3k', label: '<strong>0 - 3.000 zł</strong>' },
            { value: '3-10k', label: '<strong>3.000 - 10.000 zł</strong>' },
            { value: '10-30k', label: '<strong>10.000 - 30.000 zł</strong>' },
            { value: '30-100k', label: '<strong>30.000 - 100.000 zł</strong>' },
            { value: '100k+', label: '<strong>100.000 zł +</strong>' },
          ],
          autoAdvance: true,
          progress: 75,
        },
        {
          name: 'marketing_opis',
          type: 'textarea',
          title: 'Napisz kilka słów o wyzwaniach<br>w firmie i swoim pomyśle',
          subtitle: 'Więcej wiemy = lepiej się dopasujemy',
          placeholder: 'Np. Jaki masz budżet reklamowy? Które kanały już testujesz? Co chcesz osiągnąć w 6 miesięcy?',
          errorText: '10 słów do wyceny ➔ Bez „to zależy"',
          hint: '🏆 <b>Dobry początek, ale potrzebujemy detali.</b><br>Opisz swoją ofertę i plany dokładniej, by otrzymać trafną wycenę i dopasowane przykłady.',
          microcopy: '💡 Więcej szczegółów = Wycena 24h, <strong>bez widełek.</strong>',
          cta: 'Koniec >',
          progress: 95,
        },
        {
          name: 'contact',
          type: 'contact',
          title: '<span class="title-tight"><span class="text-shine">Udało się!</span> Składamy opcje cenowe</span>',
          subtitle: 'Komu mamy je wysłać?',
          cta: 'Wyślijcie mi propozycje',
          progress: 100,
        },
      ],
    },
  };

  // === CENNIK CONFIG ===
  const CENNIK = {
    title: 'Na co chcesz wycenę?',
    subtitle: 'Wybierz jedną z opcji.',
    options: [
      { value: 'strony', title: 'Strona internetowa' },
      { value: 'marketing', title: 'Działania marketingowe' },
      { value: 'logo', title: 'Logo lub identyfikacja' },
      { value: 'nazwy', title: 'Nazwa dla firmy' },
    ],
  };

  // === VALIDATION FUNCTIONS ===
  const validateEmail = (value: string): boolean => {
    if (value.includes('@.') || value.includes('..') || value.endsWith('.')) return false;
    return /^[^\s@]+@[a-zA-Z0-9][^\s@]*\.[a-zA-Z]{2,}$/.test(value);
  };

  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, '');
    const hasPrefix = value.trim().startsWith('+') || value.trim().startsWith('0');
    return hasPrefix ? (digits.length >= 9 && digits.length <= 15) : (digits.length === 9);
  };

  const validateWww = (value: string): { valid: boolean; error?: string } => {
    if (!value) return { valid: false, error: 'Podaj adres strony' };
    if (value.includes(' ')) return { valid: false, error: 'Adres nie może zawierać spacji' };
    if (value.toLowerCase() === 'www') return { valid: false, error: 'Czy chodziło o www.firma.pl?' };

    const cleaned = value.replace(/^(https?:\/\/)/i, '').trim();
    if (!cleaned.includes('.')) return { valid: false, error: 'Brakuje rozszerzenia (np. .pl)' };

    const domain = cleaned.split('/')[0];
    const segments = domain.split('.');

    for (let i = 0; i < segments.length; i++) {
      if (segments[i].length > 25) return { valid: false, error: 'Adres wygląda na niepoprawny' };
      if (segments[i].length === 0) return { valid: false, error: 'Niepoprawny format adresu' };
    }

    if (segments[segments.length - 1].length < 2) return { valid: false, error: 'Brakuje rozszerzenia (np. .pl)' };
    if (segments.length < 2) return { valid: false, error: 'Podaj poprawny adres (np. firma.pl)' };

    return { valid: true };
  };

  const validateName = (value: string): { valid: boolean; error?: string } => {
    if (/\d/.test(value)) return { valid: false, error: 'Imię nie może zawierać cyfr' };
    if (value.length > 30) return { valid: false, error: 'Imię jest za długie' };
    return { valid: true };
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  // === FORMAT FUNCTIONS ===
  const formatPhone = (value: string): string => {
    let cleaned = value.replace(/[^\d+]/g, '');
    const hasPlus = cleaned.startsWith('+');
    let digits = cleaned.replace(/\D/g, '');
    const maxLen = hasPlus ? 15 : 9;
    digits = digits.slice(0, maxLen);

    if (hasPlus && digits.startsWith('48') && digits.length <= 11) {
      const local = digits.slice(2);
      let formatted = '+48';
      if (local.length > 0) formatted += ' ' + local.slice(0, 3);
      if (local.length > 3) formatted += ' ' + local.slice(3, 6);
      if (local.length > 6) formatted += ' ' + local.slice(6, 9);
      return formatted;
    }

    if (hasPlus) return '+' + digits;

    let formatted = '';
    if (digits.length > 0) formatted += digits.slice(0, 3);
    if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
    if (digits.length > 6) formatted += ' ' + digits.slice(6, 9);
    return formatted;
  };

  const formatWwwOnBlur = (value: string): string => {
    let cleaned = value.trim().toLowerCase();
    cleaned = cleaned.replace(/^(https?:\/\/)/i, '');
    if (cleaned.includes('.') && !cleaned.startsWith('www.')) {
      cleaned = 'www.' + cleaned;
    }
    return cleaned;
  };

  // === HELPERS ===
  const getCurrentSteps = () => {
    if (!currentProduct) return [];
    return PRODUCTS[currentProduct]?.steps || [];
  };

  const getCurrentStepConfig = () => {
    const steps = getCurrentSteps();
    const activeSteps = steps.filter((step: any) => {
      if (step.conditional) {
        return step.conditional(answers);
      }
      return true;
    });
    return activeSteps[currentStep] || null;
  };

  const getActiveSteps = () => {
    const steps = getCurrentSteps();
    return steps.filter((step: any) => {
      if (step.conditional) {
        return step.conditional(answers);
      }
      return true;
    });
  };

  const getProgress = (): number => {
    const stepConfig = getCurrentStepConfig();
    return stepConfig ? stepConfig.progress : 0;
  };

  // === THANK YOU REDIRECT — zewnętrzny host (staging Owocnych), bez locale z bieżącej LP ===
  const getThankYouPath = (): string => {
    const base = thankYouOrigin;
    switch (currentProduct) {
      case 'strony':
        const model = answers.strona_model; // b2b | local | ecommerce | online
        if (model === 'b2b') return `${base}/dziekujemy-strony-B2B`;
        if (model === 'local') return `${base}/dziekujemy-strony-local`;
        if (model === 'ecommerce') return `${base}/dziekujemy-strony-ecom`;
        if (model === 'online') return `${base}/dziekujemy-strony-online`;
        return `${base}/dziekujemy`;
      case 'logo':
        return `${base}/dziekujemy-logo`;
      case 'marketing':
        return `${base}/dziekujemy-2`;
      case 'nazwy':
        return `${base}/dziekujemy-3`;
      default:
        return `${base}/dziekujemy`;
    }
  };

  const redirectToThankYou = (queryParams?: { email?: string; name?: string }) => {
    const path = getThankYouPath();
    const params = new URLSearchParams();
    if (queryParams?.email) params.set('email', queryParams.email);
    if (queryParams?.name) params.set('name', queryParams.name);
    const qs = params.toString();
    window.location.href = qs ? `${path}?${qs}` : path;
  };

  // === PUSH EVENT ===
  const pushEvent = (eventName: string, data: any) => {
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: eventName,
        ...data,
      });
    }
    console.log(`[DataLayer] ${eventName}:`, data);
  };

  // === INITIALIZE WITH initialProduct ===
  useEffect(() => {
    if (initialProduct && PRODUCTS[initialProduct]) {
      pushEvent('form_start', { form_name: PRODUCTS[initialProduct]?.name, product: initialProduct });
    }
  }, [initialProduct]);

  // === TRANSITION ANIMATION ===
  const changeStepWithAnimation = useCallback((nextIndex: number, eventData: any) => {
    if (isAnimating) return Promise.resolve();

    setIsAnimating(true);

    if (transitionLayerRef.current) {
      transitionLayerRef.current.classList.add('frm-transition-layer--expanding');
    }

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setCurrentStep(nextIndex);
        if (eventData) pushEvent('form_step', eventData);

        setTimeout(() => {
          if (transitionLayerRef.current) {
            transitionLayerRef.current.classList.add('frm-transition-layer--fading');
          }

          setTimeout(() => {
            if (transitionLayerRef.current) {
              transitionLayerRef.current.style.transition = 'none';
              transitionLayerRef.current.classList.remove('frm-transition-layer--expanding', 'frm-transition-layer--fading');
              void transitionLayerRef.current.offsetWidth;
              transitionLayerRef.current.style.transition = '';
            }
            setIsAnimating(false);
            resolve();
          }, 280);
        }, 50);
      }, 250);
    });
  }, [isAnimating, answers]);

  // === CTA ANIMATION ===
  const showCTA = useCallback((animate = true) => {
    if (ctaVisible) return;
    setCtaVisible(true);

    if (animate) {
      setCtaAnimating(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setCtaAnimating(true);
        });
      });
    }
  }, [ctaVisible]);

  const hideCTA = useCallback(() => {
    setCtaVisible(false);
    setCtaAnimating(false);
  }, []);

  // === HANDLERS ===
  const handleProductSelect = (productKey: string) => {
    if (isAnimating) return;

    setSelectedCennik(productKey);

    setTimeout(() => {
      setIsAnimating(true);

      if (transitionLayerRef.current) {
        transitionLayerRef.current.classList.add('frm-transition-layer--expanding');
      }

      setTimeout(() => {
        setCurrentProduct(productKey);
        setCurrentStep(0);
        setAnswers({});
        setErrors({});
        setValidFields({});
        setCtaVisible(false);
        setCtaAnimating(false);
        setSelectedCennik(null);
        pushEvent('form_start', { form_name: PRODUCTS[productKey]?.name, product: productKey });

        setTimeout(() => {
          if (transitionLayerRef.current) {
            transitionLayerRef.current.classList.add('frm-transition-layer--fading');
          }

          setTimeout(() => {
            if (transitionLayerRef.current) {
              transitionLayerRef.current.style.transition = 'none';
              transitionLayerRef.current.classList.remove('frm-transition-layer--expanding', 'frm-transition-layer--fading');
              void transitionLayerRef.current.offsetWidth;
              transitionLayerRef.current.style.transition = '';
            }
            setIsAnimating(false);
          }, 280);
        }, 50);
      }, 250);
    }, CONFIG.autoAdvanceDelay);
  };

  const handleOptionSelect = (fieldName: string, value: any, autoAdvance: boolean) => {
    setAnswers(prev => ({ ...prev, [fieldName]: value }));
    setErrors(prev => ({ ...prev, [fieldName]: null }));

    if (autoAdvance) {
      setTimeout(() => {
        const activeSteps = getActiveSteps();
        if (currentStep < activeSteps.length - 1) {
          const nextIndex = currentStep + 1;
          changeStepWithAnimation(nextIndex, {
            form_name: PRODUCTS[currentProduct!]?.name,
            form_step: nextIndex + 1,
            form_step_name: activeSteps[nextIndex]?.name,
          });
        }
      }, CONFIG.autoAdvanceDelay);
    } else {
      showCTA(true);
    }
  };

  const handleOptionClick = (fieldName: string, value: any, autoAdvance: boolean) => {
    const isAlreadySelected = answers[fieldName] === value;

    if (!isAlreadySelected) {
      handleOptionSelect(fieldName, value, autoAdvance);
    } else if (autoAdvance) {
      setTimeout(() => {
        const activeSteps = getActiveSteps();
        if (currentStep < activeSteps.length - 1) {
          const nextIndex = currentStep + 1;
          changeStepWithAnimation(nextIndex, {
            form_name: PRODUCTS[currentProduct!]?.name,
            form_step: nextIndex + 1,
            form_step_name: activeSteps[nextIndex]?.name,
          });
        }
      }, CONFIG.autoAdvanceDelay);
    }
  };

  const handleInputChange = (fieldName: string, value: string) => {
    setAnswers(prev => ({ ...prev, [fieldName]: value }));
    setErrors(prev => ({ ...prev, [fieldName]: null }));
    setValidFields(prev => ({ ...prev, [fieldName]: false }));
  };

  const handleInputBlur = (fieldName: string, value: string) => {
    let isValid = false;
    let error: string | null = null;

    if (fieldName === 'email') {
      if (!value) {
        error = 'Podaj adres e-mail';
      } else if (!value.includes('@')) {
        error = 'Brakuje znaku @';
      } else if (!validateEmail(value)) {
        error = 'Sprawdź format (np. jan@firma.pl)';
      } else {
        isValid = true;
      }
    } else if (fieldName === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (!value) {
        error = 'Podaj numer telefonu';
      } else if (digits.length >= 9 && /^(\d)\1+$/.test(digits.slice(-9))) {
        error = 'Taki numer nie istnieje';
      } else if (!validatePhone(value)) {
        error = 'Polski numer ma 9 cyfr';
      } else {
        isValid = true;
      }

      if (!value.startsWith('+') && digits.length === 9) {
        setAnswers(prev => ({ ...prev, phone: '+48 ' + formatPhone(digits) }));
      }
    } else if (fieldName === 'name') {
      const result = validateName(value);
      if (!value) {
        error = 'Wpisz swoje imię';
      } else if (!result.valid) {
        error = result.error || '';
      } else {
        isValid = true;
      }
    } else if (fieldName === 'currentWww') {
      if (value) {
        const formatted = formatWwwOnBlur(value);
        setAnswers(prev => ({ ...prev, currentWww: formatted }));
        const result = validateWww(formatted);
        if (!result.valid) {
          error = result.error || '';
        } else {
          isValid = true;
        }
      }
    }

    setErrors(prev => ({ ...prev, [fieldName]: error }));
    setValidFields(prev => ({ ...prev, [fieldName]: isValid }));
  };

  const handleDescriptionChange = (value: string) => {
    setAnswers(prev => ({ ...prev, description: value }));
    setDescriptionHintVisible(false);
    setErrors(prev => ({ ...prev, description: null }));
  };

  const handleDescriptionBlur = (value: string) => {
    const words = countWords(value);
    if (value && words < CONFIG.minDescriptionWords) {
      setDescriptionHintVisible(true);
      setErrors(prev => ({ ...prev, description: true }));
    } else if (words >= CONFIG.minDescriptionWords) {
      setValidFields(prev => ({ ...prev, description: true }));
    }
  };

  const validateCurrentStep = (): boolean => {
    const stepConfig = getCurrentStepConfig();
    if (!stepConfig) return true;

    let valid = true;
    const newErrors: Record<string, string | boolean | null> = {};

    if (stepConfig.type === 'radio' || stepConfig.type === 'product-card') {
      if (!answers[stepConfig.name]) {
        valid = false;
      }
    } else if (stepConfig.type === 'radio-expandable') {
      if (!answers[stepConfig.name]) {
        valid = false;
      } else if (answers[stepConfig.name] === 'existing' && stepConfig.expandField) {
        const wwwValue = answers[stepConfig.expandField.name] || '';
        if (!wwwValue) {
          newErrors[stepConfig.expandField.name] = 'Podaj adres obecnej strony';
          valid = false;
        } else {
          const result = validateWww(wwwValue);
          if (!result.valid) {
            newErrors[stepConfig.expandField.name] = result.error || '';
            valid = false;
          }
        }
      }
    } else if (stepConfig.type === 'textarea') {
      const text = answers.description || '';
      const words = countWords(text);
      if (words < CONFIG.minDescriptionWords) {
        newErrors.description = true;
        setDescriptionHintVisible(true);
        valid = false;
      }
    } else if (stepConfig.type === 'contact') {
      if (!answers.name) {
        newErrors.name = 'Wpisz swoje imię';
        valid = false;
      } else {
        const nameResult = validateName(answers.name);
        if (!nameResult.valid) {
          newErrors.name = nameResult.error || '';
          valid = false;
        }
      }

      if (!answers.email) {
        newErrors.email = 'Podaj adres e-mail';
        valid = false;
      } else if (!validateEmail(answers.email)) {
        newErrors.email = 'Sprawdź format (np. jan@firma.pl)';
        valid = false;
      }

      if (!answers.phone) {
        newErrors.phone = 'Podaj numer telefonu';
        valid = false;
      } else if (!validatePhone(answers.phone)) {
        newErrors.phone = 'Polski numer ma 9 cyfr';
        valid = false;
      }

      if (!answers.recipient) {
        newErrors.recipient = 'Wybierz jedną z opcji';
        valid = false;
      }
    }

    setErrors(newErrors);
    return valid;
  };

  const handleNext = () => {
    if (isAnimating || isSubmitting) return;

    if (!validateCurrentStep()) {
      pushEvent('form_error', {
        form_name: PRODUCTS[currentProduct!]?.name,
        form_step: currentStep + 1,
        error_type: 'validation'
      });
      return;
    }

    const activeSteps = getActiveSteps();

    if (currentStep < activeSteps.length - 1) {
      hideCTA();

      const nextIndex = currentStep + 1;
      changeStepWithAnimation(nextIndex, {
        form_name: PRODUCTS[currentProduct!]?.name,
        form_step: nextIndex + 1,
        form_step_name: activeSteps[nextIndex]?.name,
      }).then(() => {
        const nextStepConfig = activeSteps[nextIndex];
        if (nextStepConfig && (nextStepConfig.type === 'textarea' || nextStepConfig.type === 'contact')) {
          showCTA(true);
        }
      });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep === 0 && currentProduct && !isAnimating) {
      const productToClear = currentProduct;
      setCurrentProduct(null);
      setCurrentStep(0);
      setAnswers((prev) => {
        const next = { ...prev };
        const steps = PRODUCTS[productToClear]?.steps || [];
        steps.forEach((s: { name: string }) => {
          if (next[s.name] !== undefined) delete next[s.name];
        });
        return next;
      });
      return;
    }
    if (currentStep > 0 && !isAnimating) {
      const prevIndex = currentStep - 1;
      changeStepWithAnimation(prevIndex, null);

      const activeSteps = getActiveSteps();
      const prevStepConfig = activeSteps[prevIndex];
      if (prevStepConfig && prevStepConfig.autoAdvance) {
        hideCTA();
      }
    }
  };

  // === SEND FORM DATA ===
  const sendFormData = async () => {
    try {
      const formData = new FormData();
      
      // Podstawowe dane kontaktowe
      formData.append('name', answers.name || '');
      formData.append('email', answers.email || '');
      formData.append('phone', answers.phone || '');
      formData.append('recipient', answers.recipient || '');
      
      // Typ formularza i produkt
      formData.append('form_type', PRODUCTS[currentProduct!]?.name || '');
      formData.append('product', currentProduct || '');
      
      // Opis projektu
      formData.append('description', answers.description || '');
      
      // Wszystkie odpowiedzi z formularza
      formData.append('answers', JSON.stringify(answers));
      
      // Metadane
      formData.append('timestamp', new Date().toISOString());
      formData.append('url', typeof window !== 'undefined' ? window.location.href : '');
      formData.append('referrer', typeof window !== 'undefined' ? document.referrer : '');
      formData.append('user_agent', typeof window !== 'undefined' ? navigator.userAgent : '');
      
      // Mailing opt-in (jeśli dotyczy)
      if (PRODUCTS[currentProduct!]?.hasMailing) {
        formData.append('mailing_optin', 'pending'); // będzie zaktualizowane po wyborze użytkownika
      }

      const response = await fetch(FORM_SUBMIT_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('[FORM] Data sent successfully');
    } catch (error) {
      console.error('[FORM] Error sending form data:', error);
      // Nie przerywamy flow - użytkownik i tak zobaczy success screen
    }
  };

  const handleSubmit = async () => {
    if (Date.now() - startTimeRef.current < CONFIG.minSubmitTime) {
      console.log('[SPAM_BLOCKED] Submit too fast');
      return;
    }

    setIsSubmitting(true);

    pushEvent('generate_lead', {
      form_name: PRODUCTS[currentProduct!]?.name,
      user_data: {
        email: answers.email,
        phone: answers.phone,
        first_name: answers.name,
      },
      answers: answers,
    });

    // Wyślij dane (nie czekamy na odpowiedź, żeby nie blokować UI)
    sendFormData().catch(err => console.error('[FORM] Submit error:', err));

    setTimeout(() => {
      setIsSubmitting(false);

      if (PRODUCTS[currentProduct!]?.hasMailing) {
        setShowMailing(true);
        setTimeout(() => setMailingAnimated(true), 50);
      } else {
        redirectToThankYou({ email: answers.email, name: answers.name });
      }
    }, 800);
  };

  const handleMailingAccept = async () => {
    pushEvent('mailing_optin', {
      form_name: PRODUCTS[currentProduct!]?.name,
      user_data: { email: answers.email, first_name: answers.name },
    });
    
    // Zaktualizuj mailing opt-in w danych (jeśli potrzebne)
    try {
      const updateData = new FormData();
      updateData.append('email', answers.email || '');
      updateData.append('mailing_optin', 'accepted');
      updateData.append('form_type', PRODUCTS[currentProduct!]?.name || '');
      
      // Opcjonalnie wyślij update do webhooka
      if (FORM_SUBMIT_URL) {
        fetch(FORM_SUBMIT_URL, {
          method: 'POST',
          body: updateData,
        }).catch(err => console.error('[FORM] Mailing opt-in update error:', err));
      }
    } catch (error) {
      console.error('[FORM] Error updating mailing opt-in:', error);
    }
    
    setShowMailing(false);
    setMailingAnimated(false);
    setTimeout(() => redirectToThankYou({ email: answers.email, name: answers.name }), 350);
  };

  const handleMailingDecline = () => {
    setShowMailing(false);
    setMailingAnimated(false);
    setTimeout(() => redirectToThankYou({ email: answers.email, name: answers.name }), 350);
  };

  const handleReset = () => {
    setCurrentProduct(null);
    setCurrentStep(0);
    setAnswers({});
    setSelectedCennik(null);
    setErrors({});
    setValidFields({});
    setCtaVisible(false);
    setCtaAnimating(false);
    setShowMailing(false);
    setShowSuccess(false);
    setMailingAnimated(false);
    setDescriptionHintVisible(false);
    setIsSubmitting(false);
    startTimeRef.current = Date.now();
  };

  // === RENDER HELPERS ===
  const renderCennik = () => (
    <div className="frm-step frm-step--active" data-step="cennik">
      <fieldset className="frm-fieldset">
        <legend className="frm-sr-only">Wybierz produkt</legend>
        {CENNIK.options.map((option, index) => (
          <div
            className={`frm-cennik-card frm-cennik-card--${option.value}`}
            key={option.value}
          >
            <input
              type="radio"
              id={`cennik-${option.value}`}
              name="produkt"
              value={option.value}
              checked={selectedCennik === option.value}
              onChange={() => {}}
              onClick={() => handleProductSelect(option.value)}
            />
            <label htmlFor={`cennik-${option.value}`}>
              <span className="frm-cennik-card__title">{option.title}</span>
              <span className="frm-cennik-card__arrow">›</span>
            </label>
            <div className="frm-cennik-card__shimmer"></div>
            {index > 0 && (
              <div className="frm-cennik-card__stars">
                <div className="frm-cennik-card__star"></div>
                <div className="frm-cennik-card__star"></div>
                <div className="frm-cennik-card__star"></div>
              </div>
            )}
          </div>
        ))}
      </fieldset>
    </div>
  );

  const renderProductCard = (stepConfig: any) => (
    <div className="frm-step frm-step--active" data-step={currentStep} data-step-name={stepConfig.name}>
      <fieldset className="frm-fieldset">
        <legend className="frm-sr-only">{stepConfig.title}</legend>
        {stepConfig.options.map((option: any) => (
          <div className="frm-product-card" key={option.value}>
            <input
              type="radio"
              id={`${stepConfig.name}-${option.value}`}
              name={stepConfig.name}
              value={option.value}
              checked={answers[stepConfig.name] === option.value}
              onChange={() => {}}
              onClick={() => handleOptionClick(stepConfig.name, option.value, stepConfig.autoAdvance)}
            />
            <label htmlFor={`${stepConfig.name}-${option.value}`}>
              <span className="frm-product-card__radio"></span>
              <span className="frm-product-card__content">
                <span className="frm-product-card__title">{option.title}</span>
                <span className="frm-product-card__desc">{option.desc}</span>
                <span className="frm-product-card__badge">{option.badge}</span>
              </span>
              <span className="frm-product-card__arrow">›</span>
            </label>
          </div>
        ))}
      </fieldset>
    </div>
  );

  const renderRadio = (stepConfig: any) => (
    <div className={`frm-step frm-step--active ${stepConfig.name === 'marketing_inwestycja' ? 'frm-step--marketing-inwestycja' : ''}`} data-step={currentStep} data-step-name={stepConfig.name}>
      <fieldset className="frm-fieldset">
        <legend className="frm-sr-only">{stepConfig.title}</legend>
        {stepConfig.options.map((option: any) => (
          <div className="frm-radio" key={option.value}>
            <input
              type="radio"
              id={`${stepConfig.name}-${option.value}`}
              name={stepConfig.name}
              value={option.value}
              checked={answers[stepConfig.name] === option.value}
              onChange={() => {}}
              onClick={() => handleOptionClick(stepConfig.name, option.value, stepConfig.autoAdvance)}
            />
            <label
              htmlFor={`${stepConfig.name}-${option.value}`}
              dangerouslySetInnerHTML={{ __html: option.label }}
            />
          </div>
        ))}
      </fieldset>
    </div>
  );

  const renderRadioExpandable = (stepConfig: any) => (
    <div className="frm-step frm-step--active" data-step={currentStep} data-step-name={stepConfig.name}>
      <fieldset className="frm-fieldset">
        <legend className="frm-sr-only">{stepConfig.title}</legend>
        {stepConfig.options.map((option: any) => (
          <div
            className={`frm-radio ${option.expandable ? 'frm-radio--expandable' : ''}`}
            key={option.value}
          >
            <input
              type="radio"
              id={`${stepConfig.name}-${option.value}`}
              name={stepConfig.name}
              value={option.value}
              checked={answers[stepConfig.name] === option.value}
              onChange={() => {}}
              onClick={() => {
                const isAlreadySelected = answers[stepConfig.name] === option.value;

                if (!isAlreadySelected) {
                  handleOptionSelect(stepConfig.name, option.value, !option.expandable);
                  if (option.expandable) {
                    showCTA(true);
                  }
                } else {
                  if (option.expandable) {
                    showCTA(true);
                  } else {
                    setTimeout(() => {
                      const activeSteps = getActiveSteps();
                      if (currentStep < activeSteps.length - 1) {
                        const nextIndex = currentStep + 1;
                        changeStepWithAnimation(nextIndex, {
                          form_name: PRODUCTS[currentProduct!]?.name,
                          form_step: nextIndex + 1,
                          form_step_name: activeSteps[nextIndex]?.name,
                        });
                      }
                    }, CONFIG.autoAdvanceDelay);
                  }
                }
              }}
            />
            <label
              htmlFor={`${stepConfig.name}-${option.value}`}
              dangerouslySetInnerHTML={{ __html: option.label }}
            />
            {option.expandable && stepConfig.expandField && (
              <div
                className="frm-radio__expand"
                style={{
                  maxHeight: answers[stepConfig.name] === option.value ? '150px' : '0',
                  opacity: answers[stepConfig.name] === option.value ? 1 : 0,
                  paddingTop: answers[stepConfig.name] === option.value ? '12px' : '0',
                  visibility: answers[stepConfig.name] === option.value ? 'visible' : 'hidden',
                  overflow: answers[stepConfig.name] === option.value ? 'visible' : 'hidden',
                }}
              >
                <div className={`frm-input-group frm-input-group--nested ${errors[stepConfig.expandField.name] ? 'frm-input-group--error' : ''} ${validFields[stepConfig.expandField.name] ? 'frm-input-group--valid' : ''}`}>
                  <input
                    type="text"
                    id={stepConfig.expandField.name}
                    name={stepConfig.expandField.name}
                    className="frm-input-field"
                    placeholder=" "
                    maxLength={60}
                    autoComplete="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    inputMode="url"
                    value={answers[stepConfig.expandField.name] || ''}
                    onChange={(e) => handleInputChange(stepConfig.expandField.name, e.target.value)}
                    onBlur={(e) => handleInputBlur(stepConfig.expandField.name, e.target.value)}
                  />
                  <label htmlFor={stepConfig.expandField.name} className="frm-input-label">
                    {stepConfig.expandField.label}
                  </label>
                  <div className="frm-error-pill" role="alert">
                    <div className="frm-error-pill__content">
                      <span className="frm-error-pill__icon"></span>
                      <span className="frm-error-pill__text">
                        {errors[stepConfig.expandField.name] || stepConfig.expandField.errorText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </fieldset>
    </div>
  );

  const renderTextarea = (stepConfig: any) => (
    <div
      key={`textarea-${currentProduct}-${currentStep}`}
      className="frm-step frm-step--active"
      data-step={currentStep}
      data-step-name={stepConfig.name}
    >
      <div className="frm-step-badge">
        <span className="frm-step-badge__star">👉</span>&nbsp;&nbsp;Ostatni krok
      </div>
      <div className="frm-textarea-wrapper">
        <textarea
          className={`frm-textarea ${validFields.description ? 'frm-textarea--valid' : ''}`}
          id="description"
          name="description"
          required
          spellCheck={true}
          placeholder={stepConfig.placeholder}
          value={answers.description || ''}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          onBlur={(e) => handleDescriptionBlur(e.target.value)}
        />
        <div
          className={`frm-error-pill frm-error-pill--textarea ${errors.description ? 'frm-error-pill--visible' : ''}`}
          role="alert"
        >
          <div className="frm-error-pill__content">
            <span className="frm-error-pill__text">{stepConfig.errorText}</span>
          </div>
        </div>
      </div>

      <div
        className={`frm-textarea-hint ${descriptionHintVisible ? 'frm-textarea-hint--visible' : ''}`}
        dangerouslySetInnerHTML={{ __html: stepConfig.hint }}
      />

      <div
        className={`frm-textarea-microcopy ${descriptionHintVisible ? 'frm-textarea-microcopy--hidden' : ''}`}
        dangerouslySetInnerHTML={{ __html: stepConfig.microcopy }}
      />
    </div>
  );

  const renderContact = (stepConfig: any) => (
    <div className="frm-step frm-step--active" data-step={currentStep} data-step-name={stepConfig.name}>
      <div className={`frm-input-group ${errors.name ? 'frm-input-group--error' : ''} ${validFields.name ? 'frm-input-group--valid' : ''}`}>
        <input
          type="text"
          id="name"
          name="name"
          className="frm-input-field"
          placeholder=" "
          required
          autoComplete="given-name"
          autoCorrect="off"
          autoCapitalize="words"
          maxLength={30}
          value={answers.name || ''}
          onChange={(e) => handleInputChange('name', e.target.value)}
          onBlur={(e) => handleInputBlur('name', e.target.value)}
        />
        <label htmlFor="name" className="frm-input-label">Imię</label>
        <div className="frm-error-pill" role="alert">
          <div className="frm-error-pill__content">
            <span className="frm-error-pill__icon"></span>
            <span className="frm-error-pill__text">{errors.name || 'Wpisz imię, abyśmy wiedzieli jak się zwracać'}</span>
          </div>
        </div>
      </div>

      <div className={`frm-input-group ${errors.email ? 'frm-input-group--error' : ''} ${validFields.email ? 'frm-input-group--valid' : ''}`}>
        <input
          type="email"
          id="email"
          name="email"
          className="frm-input-field"
          placeholder=" "
          required
          autoComplete="email"
          autoCapitalize="off"
          inputMode="email"
          value={answers.email || ''}
          onChange={(e) => handleInputChange('email', e.target.value)}
          onBlur={(e) => handleInputBlur('email', e.target.value)}
        />
        <label htmlFor="email" className="frm-input-label">Email</label>
        <div className="frm-error-pill" role="alert">
          <div className="frm-error-pill__content">
            <span className="frm-error-pill__icon"></span>
            <span className="frm-error-pill__text">{errors.email || 'Sprawdź format adresu (np. jan@firma.pl)'}</span>
          </div>
        </div>
      </div>

      <div className={`frm-input-group ${errors.phone ? 'frm-input-group--error' : ''} ${validFields.phone ? 'frm-input-group--valid' : ''}`}>
        <input
          type="tel"
          id="phone"
          name="phone"
          className="frm-input-field"
          placeholder=" "
          required
          autoComplete="tel"
          autoCapitalize="off"
          inputMode="tel"
          value={answers.phone || ''}
          onChange={(e) => {
            const formatted = formatPhone(e.target.value.replace(/[a-zA-Z]/g, ''));
            handleInputChange('phone', formatted);
          }}
          onBlur={(e) => handleInputBlur('phone', e.target.value)}
        />
        <label htmlFor="phone" className="frm-input-label">Telefon (Tylko 1 SMS)</label>
        <div className="frm-error-pill" role="alert">
          <div className="frm-error-pill__content">
            <span className="frm-error-pill__icon"></span>
            <span className="frm-error-pill__text">{errors.phone || 'Numer musi mieć 9 cyfr'}</span>
          </div>
        </div>
      </div>

      <div className={`frm-input-group ${errors.recipient ? 'frm-input-group--error' : ''} ${validFields.recipient ? 'frm-input-group--valid' : ''}`}>
        <select
          id="recipient"
          name="recipient"
          className="frm-select"
          required
          value={answers.recipient || ''}
          onChange={(e) => {
            handleInputChange('recipient', e.target.value);
            if (e.target.value) {
              setValidFields(prev => ({ ...prev, recipient: true }));
              setErrors(prev => ({ ...prev, recipient: null }));
            }
          }}
        >
          <option value="" disabled>Dla kogo tworzymy wycenę? [wybierz]</option>
          <option value="board">Dla przełożonych — Przekazuję do decyzji</option>
          <option value="me">Dla mnie — Odpowiadam za budżet</option>
        </select>
        <div className="frm-error-pill" role="alert">
          <div className="frm-error-pill__content">
            <span className="frm-error-pill__icon"></span>
            <span className="frm-error-pill__text">{errors.recipient || 'Wybierz jedną z opcji'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    const stepConfig = getCurrentStepConfig();
    if (!stepConfig) return null;

    switch (stepConfig.type) {
      case 'product-card':
        return renderProductCard(stepConfig);
      case 'radio':
        return renderRadio(stepConfig);
      case 'radio-expandable':
        return renderRadioExpandable(stepConfig);
      case 'textarea':
        return renderTextarea(stepConfig);
      case 'contact':
        return renderContact(stepConfig);
      default:
        return null;
    }
  };

  const renderMailing = () => {
    if (!currentProduct || !PRODUCTS[currentProduct]?.hasMailing) return null;

    const variant = PRODUCTS[currentProduct]?.mailingVariants?.[answers.strona_model] ||
                    PRODUCTS[currentProduct]?.mailingVariants?.['online'];

    const positiveText = "POZYTYWNA";
    const chars = positiveText.split('').map((char, i) => (
      <span
        key={i}
        className="char"
        style={{ transitionDelay: `${0.4 + i * 0.12}s` }}
      >
        {char}
      </span>
    ));

    return (
      <div className={`frm-mailing ${showMailing ? 'frm-mailing--active' : ''} ${mailingAnimated ? 'frm-mailing--animated' : ''}`}>
        <div className="frm-mailing__bg">
          <div className="frm-mailing__burst-container">
            <div className="frm-mailing__burst-ripple frm-mailing__burst-ripple--1"></div>
            <div className="frm-mailing__burst-ripple frm-mailing__burst-ripple--2"></div>
            <div className="frm-mailing__burst-ripple frm-mailing__burst-ripple--3"></div>
            <div className="frm-mailing__burst-ripple frm-mailing__burst-ripple--4"></div>
          </div>
        </div>

        <div className="frm-mailing__badge">
          <span className="frm-mailing__badge-pill">
            <span className="frm-mailing__badge-label">Kwalifikacja:</span>{' '}
            <span className="frm-mailing__badge-positive">{chars}</span>
          </span>
        </div>

        <div className="frm-mailing__content">
          <header className="frm-header">
            <h1 className="frm-header__title" dangerouslySetInnerHTML={{ __html: variant?.title || '' }} />
            <p className="frm-header__subtitle" dangerouslySetInnerHTML={{ __html: variant?.subtitle || '' }} />
          </header>

          <div className="frm-mailing__features">
            <div className="frm-mailing__list-with-img">
              <div className="frm-mailing__list">
                <p className="frm-mailing__list-title">Pakiet <strong>5 maili</strong> zawiera:</p>
                <ul>
                  <li>Gotowe wzorce</li>
                  <li>Czeklisty kontrolne</li>
                  <li>Wytyczne marketingu</li>
                </ul>
              </div>
              <Image
                src="/assets/Mailing_puwdzr.png"
                alt=""
                width={120}
                height={150}
                sizes="120px"
                className="frm-mailing__list-img"
              />
            </div>
          </div>

          <div className="frm-mailing__footer">
            <div className="frm-mailing__buttons">
              <button
                type="button"
                className="frm-mailing__btn-decline"
                onClick={handleMailingDecline}
              >
                <span><strong>Nie!</strong> mam za<br/>dużo klientów</span>
              </button>
              <button
                type="button"
                className="frm-btn frm-btn--primary frm-btn--amber frm-mailing__btn-accept"
                onClick={handleMailingAccept}
              >
                <span><strong>TAK!</strong> Wyślijcie<br/>mi materiały.</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className={`frm-success ${showSuccess ? 'frm-success--active' : ''}`}>
      <div className="frm-success__icon">
        <div className="frm-success__checkmark"></div>
      </div>
      <h1 className="frm-success__title">Dziękujemy!</h1>
      <p className="frm-success__subtitle">Otrzymaliśmy Twoje zgłoszenie.</p>
      <button
        type="button"
        className="frm-btn frm-btn--primary"
        style={{ marginTop: '24px', width: 'auto' }}
        onClick={handleReset}
      >
        <span>Rozpocznij od nowa</span>
      </button>
    </div>
  );

  const stepConfig = getCurrentStepConfig();
  const activeSteps = getActiveSteps();
  const isLastStep = currentStep === activeSteps.length - 1;
  const showBackButton = (currentStep > 0 && !isLastStep) || (currentStep === 0 && !!currentProduct);
  const showCheckmark = isLastStep && currentProduct;

  const shouldShowCta = (): boolean => {
    if (!currentProduct) return false;
    if (!stepConfig) return false;

    if (stepConfig.autoAdvance && stepConfig.type !== 'radio-expandable') return false;

    if (stepConfig.type === 'radio-expandable') {
      return answers[stepConfig.name] === 'existing';
    }

    if (stepConfig.type === 'textarea' || stepConfig.type === 'contact') return true;

    return ctaVisible;
  };

  return (
    <div className={`ocf-root${embed ? ' ocf-embed' : ''}`}>
    <div className={`frm-page-wrapper ${showSuccess || showMailing ? 'frm-page-wrapper--thank-you' : ''}`}>
      <div className="frm-container">
        {!showSuccess && !showMailing && (
          <div className="frm-content">
            <header className="frm-header">
              <h1
                className="frm-header__title"
                dangerouslySetInnerHTML={{
                  __html: currentProduct
                    ? (stepConfig?.title || '')
                    : CENNIK.title
                }}
              />
              <p className="frm-header__subtitle">
                {currentProduct
                  ? (stepConfig?.subtitle || '')
                  : CENNIK.subtitle}
              </p>
            </header>

            <div className="frm-form">
              {!currentProduct ? renderCennik() : renderStep()}

              <div className="frm-footer">
                <div className="frm-buttons">
                  {showBackButton && (
                    <button
                      type="button"
                      className="frm-btn frm-btn--secondary"
                      onClick={handleBack}
                    >
                      Wstecz
                    </button>
                  )}

                  {showCheckmark && (
                    <div
                      className="frm-checkmark-wrapper frm-checkmark-wrapper--active"
                      onClick={handleBack}
                    >
                      <svg className="frm-checkmark" viewBox="0 0 305 277">
                        <path className="circle light" d="M196.6,27.6C179.1,18.3,159.2,13,138,13C69,13,13,69,13,138s56,125,125,125s125-56,125-125c0-8.5-0.9-16.8-2.5-24.9"/>
                        <path className="circle mid" d="M196.6,27.6C179.1,18.3,159.2,13,138,13C69,13,13,69,13,138s56,125,125,125s125-56,125-125c0-8.5-0.9-16.8-2.5-24.9"/>
                        <path className="circle dark" d="M196.6,27.6C179.1,18.3,159.2,13,138,13C69,13,13,69,13,138s56,125,125,125s125-56,125-125c0-8.5-0.9-16.8-2.5-24.9"/>
                        <polyline className="tick light" points="72.5,123.5 131.5,179.5 284.5,18.5"/>
                        <polyline className="tick mid" points="72.5,123.5 131.5,179.5 284.5,18.5"/>
                        <polyline className="tick dark" points="72.5,123.5 131.5,179.5 284.5,18.5"/>
                      </svg>
                    </div>
                  )}

                  {currentProduct && shouldShowCta() && (
                    <button
                      type="button"
                      ref={ctaButtonRef}
                      className={`frm-btn frm-btn--primary ${ctaAnimating ? 'frm-btn--popup-start' : ''} ${isSubmitting ? 'frm-btn--loading' : ''}`}
                      onClick={handleNext}
                      disabled={isSubmitting}
                    >
                      <span>{stepConfig?.cta || 'Dalej'}</span>
                    </button>
                  )}
                </div>

                <div className={`frm-progress ${!currentProduct ? 'frm-progress--hidden' : ''}`}>
                  <div
                    className="frm-progress__fill"
                    style={{ width: `${getProgress()}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="frm-transition-layer"
          ref={transitionLayerRef}
          aria-hidden="true"
        />

        {renderSuccess()}
        {renderMailing()}
      </div>
    </div>
    </div>
  );
};

export default OwocniForm;
