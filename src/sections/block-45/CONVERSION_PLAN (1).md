=== CONVERSION PLAN ===

SLUG: kinetic
TYP: B
DYNAMIC IMPORT: NIE (owner decision: potwierdzone)

1. GLOBAL LIBRARY MAPPING
   https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js → import gsap from 'gsap'
   https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js → import { ScrollTrigger } from 'gsap/ScrollTrigger'
   https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js → USUNIĘTE (abstrahowane przez scrollRuntime v6.x)

   GSAP_PLUGINS_USED = []  // brak pluginów poza ScrollTrigger
   
   gsap.registerPlugin(ScrollTrigger) → WEWNĄTRZ useGSAP(() => { ... }) (GSAP-SSR-01)
   Uwaga: init() ma swoje własne gsap.registerPlugin(ScrollTrigger) (L798) — idempotentne, zostawiamy.

2. SCROLL API MAPPING (scrollRuntime v6.x)

   NAME COLLISION CHECK: init() NIE deklaruje lokalnie `const/let/var scrollRuntime` → BRAK KOLIZJI ✓

   Podmiany:
   - const getScroll = () => window.lenis?.scroll ?? window.scrollY  →  USUNIĘTE (zastąpione scrollRuntime.getScroll())
   - getScroll() (local call)                                        →  scrollRuntime.getScroll()
   - window.lenis (boolean guard, L3117)                             →  USUNIĘTE (scrollRuntime zawsze dostępny)
   - window.lenis.scrollTo(target, opts)  (L3123, L3306, L3385)     →  scrollRuntime.scrollTo(target, opts)
   - window.lenis.start()  (L3303)                                   →  scrollRuntime.start()
   - window.lenis.on('scroll', handler) (L3404)                      →  scrollRuntime.on('scroll', handler)
   - window.lenis.off('scroll', handler) (L3406)                     →  scrollRuntime.off('scroll', handler)
   - scrollRuntime.requestRefresh('...') — BEZ ZMIAN (już poprawne w hardened init)

   Łącznie: 8 podmian + 1 usunięcie (getScroll helper)

3. SELEKTORY — zostają w init()
   $, $$, $id — scoped do container wewnątrz init(). Brak zmian.
   rootRef.current przekazywany jako container do init().

4. ANTI-FOUC — inline styles JSX
   Analiza gsap.from/fromTo/set z literałami w init():
   
   a) gsap.set([$id('kinetic-block-1'), $id('kinetic-block-2'), $id('kinetic-block-3')], { autoAlpha: 0 })
      → POMIŃ — CSS .text-block ma: opacity: 0; visibility: hidden; (L388-389)
   
   b) gsap.set($$(".blob"), { opacity: 0 })
      → POMIŃ — CSS .blob ma: opacity: 0 (L224)
   
   c) gsap.set(pqCanvas, { scale: 0.85, opacity: 0, ... })
      → POMIŃ — canvas to programmatyczny element, opacity:0 wystarczy. Dodaję inline opacity:0 na canvas.
      → #kinetic-particle-qmark-canvas: style={{ opacity: 0 }}
   
   d) gsap.set(nigdyGlow, { scale: 0, ... })
      → #kinetic-nigdy-glow: CSS .nigdy-glow ma opacity: 0 → covered
   
   e) gsap.set(_elCylWrap, { xPercent: -50, ... })
      → #kinetic-cylinder-wrapper: CSS ma opacity: 0 → covered
   
   f) gsap.set(nigdyPlate, { xPercent: -50, yPercent: -50, scale: 0.5, rotation: 45, opacity: 0.3 })
      → POMIŃ — parent (.text-block) ma visibility:hidden → nie widoczna do momentu GSAP
   
   g) gsap.set(problemLine, { scale: 3, ... })
      → POMIŃ — parent (.text-block) ma visibility:hidden
   
   h) gsap.set(b3, { yPercent: -50, ... })
      → POMIŃ — parent (.text-block) ma visibility:hidden
   
   FOUC inline styles zaplanowane: 1 element
     - #kinetic-particle-qmark-canvas: style={{ opacity: 0 }} (guard: canvas widoczny przed GSAP init)

5. SPLITTEST
   splitIntoChars — custom split (VAN-SPLIT PASS). Brak SplitText plugin. Brak potrzeby visibility:hidden.

6. DYNAMIC IMPORT
   NIE (manifest.dynamicImport: false, owner decision)

7. DEV OVERLAY
   Kod z stack.html już ma DEV overlay USUNIĘTY (stack.html line 765-771: komentarz potwierdzający).
   init() w stack.html nie zawiera bloku FACTORY:DEV-OVERLAY:START/END.
   DEBUG_MODE w init() zachowany (Factory infrastructure pattern — warunkowy logging, zero side-effects).

8. PREVIEW DELTA
   CDN libs (pinned):
     gsap 3.12.5, ScrollTrigger 3.12.5
     Lenis 1.0.42 (wymagany dla snap system w PREVIEW)
   scrollRuntime stub:
     getScroll: () => window.lenis?.scroll ?? window.scrollY
     getRawScroll: () => window.lenis?.actualScroll ?? window.scrollY
     requestRefresh: (reason) => { clearTimeout(_t); _t = setTimeout(() => ScrollTrigger.refresh(true), 120); }
     scrollTo: (target, opts) => { if (window.lenis) window.lenis.scrollTo(target, opts); }
     start: () => { if (window.lenis) window.lenis.start(); }
     on: (event, handler) => { if (window.lenis) window.lenis.on(event, handler); }
     off: (event, handler) => { if (window.lenis) window.lenis.off(event, handler); }
   Status: OGRANICZONY — PREVIEW ma Lenis (snap system wymaga), React ma scrollRuntime v6.x.
   Różnica: w PREVIEW stub deleguje do window.lenis bezpośrednio. W React — scrollRuntime abstrahuje.

9. WERYFIKACJA PRZED GENEROWANIEM (checklisty)
   [x] Każdy querySelector jest container-scoped wewnątrz init() (przez $/$$ helper lub bezpośrednio)
   [x] Każdy addEventListener ma odpowiadający cleanup w cleanups[]
   [x] CSS kopiuję IDENTYCZNIE — zero modyfikacji zaplanowane
   [x] Wszystkie wartości GSAP będą IDENTYCZNE z vanilla
   [x] Blok DEV overlay — już usunięty w source (stack.html)
   [x] Inline style: 1 element (#kinetic-particle-qmark-canvas: opacity:0)
   [x] Dynamic import — NIE (manifest)
   [x] Dynamic import: N/A (nie dotyczy)
   [x] useGSAP cleanup (return function) = `return () => inst?.kill?.()` — NIE przepisuję wnętrza kill()
   [x] GSAP-SSR-01: gsap.registerPlugin() WEWNĄTRZ useGSAP(() => {...}) — NIE na module top-level pliku .tsx

=== KONIEC CONVERSION PLAN ===
