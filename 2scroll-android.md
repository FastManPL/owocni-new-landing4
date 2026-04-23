Rozwiązanie niemożliwego scrollowania na mobile:

Dodanie syncTouch: true w konfiguracji Lenis
Plik: src/lib/scrollRuntime.ts
Funkcja: runBoot (linia ~71)
Zmiana: dodanie dwóch linii do konfiguracji Lenis:
javascript
lenis = new Lenis({
autoRaf: false,
lerp: 0.1,
duration: 1.2,
smoothWheel: true,
wheelMultiplier: 1,
touchMultiplier: 1,
syncTouch: true, // ← nowe
syncTouchLerp: 0.1, // ← nowe
});
Commit: ad44c7b na gałęzi repair/mobile-scroll

Dlaczego to działało
Bez syncTouch: Lenis dla touch events pozwalał natywnemu scrollowi się wydarzyć, potem próbował go "dogonić". Na mobile z CSS, który masz (overflow-y: auto na html i body w @media mobile), ta "pogoń" się nie udawała — scroll był martwy mimo że klasy lenis-scrolling były dodane do <html>.
Z syncTouch: true: Lenis przechwytuje touch events synchronicznie (podobnie jak wheel), bierze pełną kontrolę nad scrollem. Zero konfliktu z natywnym, zero "Ignored attempt to cancel touchmove" errorów (przedtem było 207 takich w konsoli, po fixie zero).
Factory PREVIEW Kinetica miał syncTouch: true już od początku (Cursor potwierdził), dlatego preview działał na Pixelu gdy go testowałeś — a produkcja nie.
