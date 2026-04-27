# PROMPT 10 — Retest Playbook (10 min)

Cel: domknąć otwarte punkty A1/A2/B1/C1/D1 po wdrożeniach.

## 0) Warunki testu (1 min)

- Testuj na deploy: `https://owocni-new-landing4.vercel.app`
- Użyj normalnego Chrome (nie headless).
- Wyłącz rozszerzenia, otwórz stronę w nowej karcie incognito.
- Dla testu desktop: DevTools Performance z CPU slowdown `20x`.
- Dla testu mobile: realne urządzenie (np. Realme 8), normalny tryb przeglądarki.

## 1) A1/A2/C1 — płynność + long tasks (3 min)

1. Otwórz DevTools -> `Performance`.
2. Ustaw CPU `20x slowdown`.
3. Kliknij `Record`.
4. Odśwież stronę i wykonaj:
   - pierwszy scroll do sekcji `Onas`,
   - interakcję w okolicy `Onas` (hover/tap),
   - krótki scroll dalej i powrót.
5. Zatrzymaj nagrywanie.

Zapisz:
- `Longest Task (ms)` (najdłuższy long task)
- liczba zadań `> 50ms`
- subiektywnie: czy pierwszy scroll/klik jest wyraźnie płynniejszy niż wcześniej (`tak/nie`)

Kryterium PASS:
- mniej long tasków niż przed zmianami,
- brak widocznego freeze przy wejściu do `Onas`,
- brak regresji animacji narracyjnej.

## 2) B1 — fallback badge i obraz (2 min)

Na słabszym telefonie:
1. Wejdź do sekcji `Onas`.
2. Sprawdź, czy badge fallback jest widoczny i proporcjonalny.
3. Sprawdź, czy nie zasłania tekstu i czy wygląda jak zamierzona kompozycja.

Zapisz:
- `fallback visible`: `tak/nie`
- `fallback scale`: `ok / za mały / za duży`
- `decode/pop-in`: `brak / lekki / duży`

Kryterium PASS:
- fallback zawsze widoczny w trybie fallback,
- bez „skakania” layoutu,
- bez degradacji kompozycji.

## 3) Books — pierwsza klatka (1 min)

1. Wejdź do sekcji `books`.
2. Odśwież stronę 2-3 razy.
3. Sprawdź, czy zamiast placeholdera zawsze pojawia się pierwsza klatka sekwencji.

Zapisz:
- `first frame issue`: `0/3`, `1/3`, `2/3`, `3/3` (ile razy wystąpił problem)

Kryterium PASS:
- `0/3`.

## 4) Final — fallback tekstu (1 min)

1. W warunkach fallback sprawdź sekcję `Final`.
2. Oceń, czy napis ma właściwą wagę wizualną względem pełnej wersji.

Zapisz:
- `fallback text size`: `ok / za mały / za duży`

Kryterium PASS:
- `ok`.

## 5) D1 — bfcache manual na deploy (2 min)

1. DevTools -> `Application` -> `Back/forward cache`.
2. Wejdź na stronę, przejdź na inny URL (np. example.com), wróć Back.
3. Sprawdź wynik panelu bfcache.
4. W konsoli sprawdź:
   - `performance.getEntriesByType('navigation')[0]?.type`
   - nasłuch `pageshow` i `event.persisted`.

Zapisz:
- `navigation.type`: wartość
- `pageshow.persisted`: `true/false`
- `bfcache blockers`: lista (jeśli są)

Kryterium PASS:
- tam gdzie możliwe: `persisted=true`,
- jeśli nie: konkretne, powtarzalne blokery.

---

## Format odpowiedzi do wklejenia (uzupełnij i odeślij)

`A1/A2/C1`
- longest_task_ms:
- long_tasks_over_50ms:
- first_scroll_click_smoother: tak/nie

`B1`
- fallback_visible:
- fallback_scale:
- decode_popin:

`Books`
- first_frame_issue:

`Final`
- fallback_text_size:

`D1`
- navigation_type:
- pageshow_persisted:
- bfcache_blockers:
