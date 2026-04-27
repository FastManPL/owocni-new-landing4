# PROMPT 10 — Mobile performance checklist (low-end Android)

Cel: poprawa wydajności bez zmiany obecnego wyglądu na normalnych urządzeniach.
Tryb pracy: małe, odwracalne zmiany, 1 commit = 1 hipoteza.

## Zasady rollout

- [ ] Każda zmiana ma osobny commit i push.
- [ ] Każdy commit ma opis: obszar + hipoteza + numer kroku.
- [ ] Po każdym kroku zapisujemy: wynik pomiaru, ryzyko regresji, decyzję (zostaje/cofamy).
- [ ] Jeśli regresja UX/perf: natychmiastowy rollback pojedynczego commit hash.

---

## Priorytet A — największy zysk CPU

### Krok A1 — Tier-0 aggressive mode dla WebGL/Three

- [ ] Ograniczyć DPR/effects/particle count na `low-end` (Tier 0) w najcięższych sekcjach.
- [ ] Najpierw 1 sekcja (np. `Blok45`), potem pomiar.
- [x] Następnie 2 sekcja (np. `Onas`), osobny commit.
- [ ] Nie zmieniać layoutu/treści ani wariantu wizualnego na Tier 1/2.

**Weryfikacja po kroku:**
- [ ] FPS/scroll płynność na słabym Androidzie lepsza.
- [ ] Brak regresji wizualnej na desktop + normalnym mobile.
- [ ] INP/interakcje nie pogorszone.

**Commit template:** `PROMPT 10 — mobile perf A1: tier0 webgl budget (<sekcja>)`
**Rollback:** `git revert <hash>`

---

### Krok A2 — Deferred engine init below fold

- [x] Przenieść start ciężkich engine'ów na section-in-view (bez zmiany SSR markup).
- [ ] Zachować istniejący wygląd po wejściu sekcji w viewport.
- [x] 1 sekcja = 1 commit.

**Weryfikacja po kroku:**
- [ ] Mniej pracy CPU na starcie strony.
- [ ] Brak „flash/jump” przy pierwszym wejściu sekcji.

**Commit template:** `PROMPT 10 — mobile perf A2: defer engine init (<sekcja>)`
**Rollback:** `git revert <hash>`

---

## Priorytet B — decode / media

### Krok B1 — obrazki mobile variants

- [x] Dokręcić `sizes` i warianty mobile dla największych obrazów sekcji below-fold.
- [ ] Bez zmiany kompozycji, tylko mniejszy koszt decode/transfer na małych ekranach.

**Weryfikacja po kroku:**
- [ ] Decode time spada.
- [ ] Brak utraty jakości zauważalnej wizualnie.

**Commit template:** `PROMPT 10 — mobile perf B1: image decode budget (<sekcja>)`
**Rollback:** `git revert <hash>`

---

## Priorytet C — main-thread scheduling

### Krok C1 — rozbicie długich tasków init

- [x] Podzielić init >50ms na mniejsze porcje (bez zmiany efektu końcowego).
- [ ] Najpierw sekcja z największym pojedynczym taskiem w pomiarze.

**Weryfikacja po kroku:**
- [ ] Mniej long-tasków.
- [ ] Lepsza responsywność podczas pierwszego scroll/klik.

**Commit template:** `PROMPT 10 — mobile perf C1: split long init task (<sekcja>)`
**Rollback:** `git revert <hash>`

---

## Priorytet D — na końcu

### Krok D1 — bfcache eligibility (prod)

- [ ] Sprawdzić bfcache na deploy/staging (nie localhost).
- [ ] Zanotować konkretne blokery i ich źródła.

**Weryfikacja po kroku:**
- [ ] `pageshow.persisted=true` przy back/forward tam, gdzie możliwe.

**Commit template:** `PROMPT 10 — mobile perf D1: bfcache blockers (<obszar>)`
**Rollback:** `git revert <hash>`

---

## Dziennik zmian (uzupełniamy po każdym push)

| Krok | Commit hash | Pomiar before/after | Decyzja |
|------|-------------|---------------------|---------|
| A1-1 |             |                     |         |
| A1-2 | 6fbe234     | TODO (mobile retest) | Zostaje (pending retest) |
| A2-1 | 1167f3b     | TODO (mobile retest) | Zostaje (pending retest) |
| B1-1 | 24b7848     | TODO (mobile retest) | Zostaje (pending retest) |
| C1-1 | 7de77ec     | TODO (trace retest) | Zostaje (pending retest) |
| D1-1 |             |                     |         |

