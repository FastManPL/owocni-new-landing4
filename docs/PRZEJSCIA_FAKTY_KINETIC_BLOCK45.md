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
| **Fakty → Kinetic** | ScrollTrigger na `#bridge-wrapper`: gdy wrapper wjeżdża od dołu (`top bottom-=15%` → `top top`), animacja opacity 0→1 na warstwie Kinetic (miękki fade-in). |
| **Kinetic → Block 4-5** | W Blok45Engine: trigger startu Kipiel = wejście **sekcji** (lub wave-wrap) w viewport (`trigger: container`, `start: 'top bottom'`), nie `voidSectionWrapper` — wave startuje razem z wjazdem Block 4. |
