# EVIDENCE PACK — wyniki-cs-tiles

## AUDYT WEJŚCIA (P1): PASS
- namespace: OK (130 selektorów)
- lifecycle: OK (init/kill/pause/resume)
- triaż: Typ B (canvas rAF flywheel)

## CPU GATING (P2A): Ścieżka 1
- mechanizm: IO→pause/resume (canvas rAF only)
- gatingTarget: root (container)
- rootMargin: 0.5×VH clamp 200-1200px
- viewport source: visualViewport.height (fallback: innerHeight)
- recreate on: visualViewport.resize z debounce 50ms

## AUTO-FIXy
- pause()/resume() dodane
- Factory IO gating (visualViewport recreate)
- kill() rozszerzony (ScrollTrigger scoped cleanup)
- DEV overlay za DEBUG_MODE
- .is-init degradation class
- ScrollTrigger.config({ ignoreMobileResize: true })
- Panel HTML/CSS/hints usunięte
- HUD + diagnostic panel za if(DEBUG_MODE)

## BRAMKI
| Bramka | Status |
|--------|--------|
| B-LC-RET-01 | PASS |
| PIN-DISABLE-01 | N/A |
| B-CPU-03 | PASS |
| B-CPU-04 | N/A |
| B-CPU-05 | PASS |
| B-REF-01 | PASS |
| B-REF-02 | PASS |
| B-CSS-01 | PASS |
| B-ISO-01 | JUŻ BYŁ (×3) |
| HTML-FONTSIZE-01 | PASS |
| ST-01 | PASS |
| ST-02 | PASS |
| ST-CLEAN-01 | PASS |
| INP-LEAK-01 | PASS |
| INIT-DOM-01 | PASS |
| MED-01 | PASS |
| DEV-DEL-01 | PASS |
| NULL-GUARD-01 | PASS |
| IO-SAFE-01 | PASS |
| CLN-01 | PASS |
| SM-01 | PASS |
| SM-02 | PASS |

## PERF WARNINGS
- PERF-W3: 4× video bez poster
- PERF-W9: canvas bez will-change

## CDN LIBRARIES
- gsap 3.12.7
- ScrollTrigger 3.12.7

## WERDYKT: PASS
