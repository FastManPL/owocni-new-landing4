# Przejścia: Fakty → Kinetic → Block 4-5 (opis po ludzku)

## 1. Przejście Fakty → Kinetic

### Jak ma być (z dokumentacji: integracja.md §3, BRIEF)

- **Nie** ma być efektu „nagle pojawia się nowa sekcja”.
- Ma być **jedna scena**: na górze ekranu Fakty (litery, transparentne tło), na dole to samo jasne tło (#f7f6f4) i **już widać** rodzące się elementy Kinetic (bloby, particles).
- W miarę scrolla: Fakty **wyjeżdża w górę** (jak kurtyna), a Kinetic **odsłania się** od centrum/dołu — puste strefy (dół Fakty, góra Kinetic) się **pokrywają**, bez skoku.
- Pełna wersja = Fakty i Kinetic w **jednym wrapperze** z pinem: Fakty jako warstwa na wierzchu jedzie `yPercent: -100`, Kinetic pod spodem „rodzi się” w tym samym czasie.

### Dlaczego teraz jest „nagle”

- Fakty jest **poza** wrapperem (żeby ScrollTriggery i organic overlay działały), więc nie ma jednego pinu i overlapu.
- Scrollujemy Fakty, potem od razu wjeżdża **cały** wrapper z Kinetic (100vh) — wygląda to jak skok w nową sekcję.

### Dopieszczenie (bez przenoszenia Fakty do wrappera)

- **Miękkie wejście Kinetic**: gdy wrapper z Kinetic zbliża się do viewportu (np. jego górna krawędź wchodzi od dołu), Kinetic **stopniowo się pokazuje** (np. fade-in lub krótki reveal), zamiast „włączyć się” w jednej klatce.
- Realizacja: ScrollTrigger na wrapperze, np. `start: "top bottom-=15%"`, `end: "top top"`, scrub: opacity 0→1 na warstwie Kinetic — efekt „wypływa” z dołu ekranu zanim pin się włączy.

---

## 2. Przejście Kinetic → Block 4-5 (Curtain Reveal)

### Jak ma być (z dokumentacji: integracja.md §7B, §10)

1. Kinetic **stoi zamrożona** na ostatniej klatce (snap3: Block 3, cylinder, bloby).
2. **Pin nadal trwa** — wrapper z Kinetic jest `position: fixed`.
3. Użytkownik scrolluje dalej → **Block 4 wjeżdża od dołu** (z-index wyższy, tło transparentne), więc widać jeszcze Kinetic pod spodem.
4. **Wave Reveal (Kipiel, SVG)** od razu **zasłania** Kinetic — kolory przechodzą w tło strony (#f7f6f4), żeby **nie było widać** przewijania ani „odmrażania” Kinetic.
5. Dopiero gdy Block 4 (i wave) **zakryją cały ekran** → pin puszcza (niewidocznie dla użytkownika).

### Problem teraz

- W momencie dojechania do końca Kinetic pin się kończy → Kinetic się **odmraża** i zaczyna scrollować.
- Dopiero **niżej** wjeżdża Block 4 z animacją wave.
- Użytkownik widzi: najpierw „rozmrożenie” Kinetic i jej scroll, potem dopiero wejście Block 4.

### Dopieszczenie

- **Wave (Kipiel) ma startować w chwili, gdy sekcja Block 4 **wchodzi** w viewport** (np. `top` sekcji przy `bottom` viewportu), a nie dopiero gdy w viewport wjeżdża `voidSectionWrapper` („i wychodzą”).
- Wtedy: od pierwszej klatki wjazdu Block 4 od dołu ekranu **od razu** idzie animacja wave i zasłania Kinetic — nie widać przewijania Kinetic, tylko kurtynę wave i treść Block 4.

---

## Podsumowanie zmian w kodzie

| Przejście | Zmiana |
|-----------|--------|
| **Fakty → Kinetic** | ScrollTrigger na `#bridge-wrapper`: gdy wrapper wjeżdża od dołu (`top bottom` → `top top`), animacja opacity 0→1 na warstwie Kinetic (miękki fade-in). |
| **Kinetic → Block 4-5** | W Blok45Engine: gdy jest `#bridge-pin-end-sentinel`, wave (stWaveVis + stWaveTrigger) używa sentinela z `start: 'top bottom'` — moment wejścia ~100vh przed końcem pinu (przed odmrożeniem). Wave w portalu nad Kinetic; onLeave jak w oryginale (display none). stWaveScroll bez zmian (waveAnchor). |

---

## Fazy końca Kinetic (dla ustawienia momentu wejścia Block 4-5)

Żeby doprecyzować, **kiedy dokładnie** ma wchodzić sekcja blok-4-5 (wave), poniżej fazy końca Kinetic w bridge:

| Faza | Opis | Progress timeline | Scroll |
|------|------|-------------------|--------|
| **SNAP1** | Pełne zdanie Block 1 | SNAP1_U / TOTAL_U | początek „kinetic” scrub |
| **SNAP2** | „?” widoczny (U = I+9.5) | SNAP2_U / TOTAL_U | — |
| **SNAP3** | Ostatnia klatka (cylinder, bloby) | SNAP3_U / TOTAL_U ≈ 0,955 | freeze start (FREEZE_ON) |
| **Freeze** | Animacja zamrożona na SNAP3 | tlProgress ≥ FREEZE_ON | scroll w zakresie freeze |
| **Koniec pinu** | Pin release, Kinetic „odmraża” i ucieka w górę | progress = 1 (koniec ST) | scroll = `st.end` = scrollTimelinePx + 100vh |

- **Curtain** = ostatnie **100vh** scrollu pinu: `[st.end - innerHeight, st.end]`. W tym przedziale Kinetic jest już zamrożona, użytkownik scrolluje „w pustce”.
- **Sentinel** `#bridge-pin-end-sentinel` jest na dole pin spacera. Gdy **góra sentinela** = **dół viewportu** (`start: 'top bottom'`), jesteśmy na początku curtain, czyli **~100vh przed odmrożeniem**. Wave powinien startować w tym momencie (lub wcześniej, np. `top bottom+=50%` = ~150vh przed końcem, jeśli potrzeba).
