/**
 * Wspólne dane FAQ — sekcja + `FAQJsonLd` (Faza 2.2 / SEO).
 * Konstytucja B3: namespace FAQ, zero importów między sekcjami.
 */
export type FaqItem = { q: string; a: string };

export type AbcColumn = { letter: string; text: string };

export const faqDataLeft: FaqItem[] = [
  { q: 'Jak rozpocząć współpracę?', a: `Wszystko zaczyna się od <strong>warsztatu strategicznego</strong> z naszym zespołem.<br>Niezwłocznie po podpisaniu umowy.<br><br><strong>Na warsztacie:</strong><br>• Doprecyzowujemy harmonogram i Twoje oczekiwania<br>• Definiujemy cele, KPI i zakres projektu<br>• Sprawdzamy, czy "mamy do siebie chemię"<br><br><strong>Kluczowe:</strong> Po pierwszym warsztacie zdecydujemy wspólnie, czy "jest między nami chemia" — jeśli to nie będzie to czego oczekujesz, możesz natychmiast rozwiązać umowę bez żadnych kosztów. A my pokryjemy koszty przygotowań.<br><br>Projekt startujemy z reguły w ciągu <strong>3 dni roboczych</strong> od podpisania umowy.<br><br>Prosto i bez ryzyka.` },
  { q: 'Jak przebiega proces realizacji?', a: `Jeśli idzie o Twoje zaangażowanie, jest ono <strong>minimalne</strong>.<br><br>Cała realizacja sprowadza się do:<br>• Maksymalnie 2 spotkań (warsztaty strategiczne po ~1,5h każdy)<br>• Zgłaszanie uwag i sugestii do przygotowywanych projektów<br><br>Resztę zrobimy za Ciebie w 3 etapach.<br><br><strong>Etap 1: UX & Copywriting</strong> (tydzień 1-3)<br>Analiza konkurencji + profil klienta + klikalny prototyp<br><br><strong>Etap 2: Design</strong> (tydzień 3-5)<br>Projektowanie wizualne + hierarchia elementów<br><br><strong>Etap 3: Wdrożenie</strong> (tydzień 5-8)<br>Programowanie + testy + szkolenie z panelu` },
  { q: 'Co przygotować do współpracy?', a: `Musisz wiedzieć tylko <strong>CO chcesz oferować światu</strong>.<br>Resztę wypracujemy razem z zespołem specjalistów.<br><br>Na warsztatach strategicznych wydobędziemy od Ciebie potrzebne informacje, przejrzymy liderów w branży i ustalimy strategię konkurowania.<br><br>Materiały wizualne potrzebne są dopiero w etapie 3 (design). Możemy śmiało zaczynać bez nich — będziesz miał czas się przygotować.<br><br>Z reguły są to:<br>• Logotypy i materiały identyfikacyjne (jeśli istnieją)<br>• Zdjęcia produktów/zespołu (jeśli będą potrzebne)` },
  { q: 'Jak wygląda opieka po starcie?', a: `W okresie rozruchowym możesz liczyć na nasze <strong>pełne wsparcie</strong>.<br>Wsparcie techniczne. Szkolenia wideo z obsługi. Wyjaśnienia.<br><br>W długim dystansie posiadamy różne modele opieki. Włącznie z reakcją <strong>24/7</strong>.<br><br>Opieka 24/7 oznacza, że jeśli coś wymaga natychmiastowej reakcji — odbierzemy to nawet w niedzielę w nocy i zareagujemy w ciągu godziny.<br><br>Plany opieki tworzymy indywidualnie w zależności od potrzeb:<br>• Backupy, aktualizacje bezpieczeństwa<br>• Monitoring i naprawa awarii<br>• Pomoc z certyfikatami, domeną, pocztą<br>• I wszystko czego potrzebujesz by się nie martwić<br><br>Zazwyczaj jest to spokój ducha w cenie dobrego obiadu.` },
];

export const faqDataRight: FaqItem[] = [
  { q: 'Co jeśli projekt się opóźni?', a: `<strong>Termin to nasza najważniejsza wartość.</strong><br>Dlatego ustalony harmonogram jest dla nas święty.<br><br>Zarządzamy kilkoma projektami jednocześnie, więc precyzyjnie planujemy każdy krok od samego startu.<br><br>Aby zapewnić Ci poczucie bezpieczeństwa, nasza umowa przewiduje <strong>konkretne kary finansowe</strong> za każdy dzień opóźnienia z naszej strony.<br><br>Wierzymy, że rzeczy zrobione bez wysiłku, oglądają się bez przyjemności. Dlatego nie przyjmujemy wyzwań krótszych niż 30 dni.<br><br>Możesz czuć się bezpiecznie.` },
  { q: 'Czy gwarancja zawsze działa?', a: `Są dwa przypadki, kiedy nie możemy zagwarantować wzrostu:<br><br><strong>Przypadek 1. Startujesz z nową stroną</strong> (brak punktu odniesienia)<br>Nie mamy starej wersji do porównania, więc nie możemy przeprowadzić testów A/B. Jednak nawet nad nową stroną pracuje ten sam zespół ekspertów. Dlatego otrzymasz cały know-how i najlepsze praktyki nawet jeśli to będzie nowa marka.<br><br><strong>Przypadek 2. Za mało danych do pomiaru statystycznego</strong><br>Jeśli rzucisz kostką 10 razy i szóstka wypadnie 6 razy — to nie znaczy, że kostka jest magiczna. Potrzebujemy odpowiedniej liczby zdarzeń, aby mieć statystyczną pewność, że nasza praca faktycznie podniosła konwersję.` },
  { q: 'Jesteście drożsi od konkurencji?', a: `Dobrze, że chcesz to zobaczyć. Najlepiej widać to w liczbach.<br><br>Różnica między pojedynczym młodym freelancerem, a dojrzałym zespołem — to różnica między <strong>dziesięcioma zapytaniami a czterdziestoma</strong> z tej samej liczby odwiedzin strony.<br><br>Uzyskanie wysokich zwrotów z inwestycji to zadanie dla całego zespołu.<br><br>W Owocnych otrzymujesz ten sam proces. Te same kompetencje. I ten sam zespół, który realizuje duże giełdowe projekty w kwotach często przekraczających 100.000 zł, za ułamek tej ceny.<br><br>Oszczędności rzędu kilku tysięcy złotych na starcie potrafią zmienić się w kilkadziesiąt, czy nawet kilkaset tysięcy złotych strat rocznie.<br><br><strong>Prawdziwa cena to zwrot z inwestycji w czasie.</strong>` },
];

export const abcData: AbcColumn[] = [
  { letter: '3', text: '<strong>Nie masz<br>czasu</strong> się tym<br>zajmować.' },
  { letter: '2', text: 'Ale chcesz, by<br>ktoś wziął to<br>na siebie.' },
  { letter: '1', text: 'Tak, aby było<br>to <strong>zrobione<br>porządnie.</strong>' },
];

export const TOTAL_FAQ = faqDataLeft.length + faqDataRight.length;

/** Tekst odpowiedzi do JSON-LD (bez tagów HTML). */
export function faqAnswerPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
