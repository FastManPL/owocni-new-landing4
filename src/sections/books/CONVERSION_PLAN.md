# CONVERSION PLAN — book-stats

## INPUT SUMMARY
- **Slug:** book-stats
- **Type:** B (canvas + ScrollTrigger scrub + drawFrame)
- **CDN Libraries:** gsap@3.12.5, ScrollTrigger@3.12.5
- **CPU Gating:** Ścieżka 3a (N/A) — pin+scrub = natural gating
- **hasPin:** true
- **dynamicImport:** false

---

## 1. GLOBAL LIBRARY MAPPING

| CDN | NPM Import |
|-----|------------|
| `gsap.min.js` | `import gsap from 'gsap'` |
| `ScrollTrigger.min.js` | `import { ScrollTrigger } from 'gsap/ScrollTrigger'` |

**GSAP_PLUGINS_USED:** `['ScrollTrigger']`

---

## 2. SCROLL API MAPPING

| Vanilla | React |
|---------|-------|
| `window.lenis ? window.lenis.scroll : window.scrollY` | `scrollRuntime.scroll()` |
| `window.scrollRuntime.requestRefresh()` | `scrollRuntime.requestRefresh()` |

**Import:** `import { scrollRuntime } from '@/shared/scroll-runtime'`

---

## 3. SELECTOR STRATEGY

**Decision:** STAY IN init()

Wszystkie selektory używają wzorca:
```js
var $ = function(sel) { return container.querySelector(sel); };
var $$ = function(sel) { return container.querySelectorAll(sel); };
var $id = function(id) { return container.querySelector('#' + id); };
```

Wzorzec `container.querySelector` jest już container-scoped — **brak zmian**.

---

## 4. ANTI-FOUC INLINE STYLES

**Analiza gsap.from/fromTo:**

W kodzie występują tylko:
- `gsap.to(h, { backgroundPosition: ... })` — animuje DO wartości, nie FROM
- Brak `gsap.from()` ani `gsap.fromTo()`

**Wniosek:** BRAK inline styles anti-FOUC wymaganych.

---

## 5. SPLITTEXT HANDLING

**Analiza:** Brak użycia SplitText w kodzie.

**Wniosek:** N/A

---

## 6. DYNAMIC IMPORT STRUCTURE

**Owner decision:** `dynamicImport: false`

**Wniosek:** Komponent importowany statycznie, brak lazy() wrapper.

---

## 7. DEV OVERLAY REMOVAL

**Evidence Pack:** `DEV-DEL-01: N/A — nie dodano DEV overlay (sekcja ma własny DEBUG_MODE)`

**Wniosek:** Brak DEV overlay do usunięcia. DEBUG_MODE pozostaje (read-only URLSearchParams).

---

## 8. PREVIEW DELTA

| Element | reference.html | PREVIEW.html |
|---------|----------------|--------------|
| scrollRuntime | undefined (stub) | stub z window.scrollY + 120ms debounce |
| Fonts CDN | Google Fonts link | zachowany |
| TEST SHELL | spacery scroll | zachowane |
| SENTRY | #book-stats-sentry | zachowany |

---

## 9. PRE-GENERATION VERIFICATION

| Gate | Status |
|------|--------|
| B-LC-RET-01 | ✅ PASS — `return { kill, pause, resume }` |
| P3-CLEAN-01 | ✅ PASS — `if (_killed) return; _killed = true;` |
| DEV-DEL-01 | ✅ N/A — brak DEV overlay |
| ST-CLEAN-01 | ✅ PASS — ST.kill() w bookFramesCleanup |
| INP-LEAK-01 | ✅ PASS — cleanups zawiera `window.removeEventListener('scroll', onScroll)` |
| INIT-DOM-01 | ✅ PASS — wszystkie modyfikacje wewnątrz container |
| PIN-DISABLE-01 | ✅ N/A — Ścieżka 3a, brak Factory IO gating |

---

## 10. CONVERSION ACTIONS

1. **JSX:** Zamiana HTML na JSX (className, htmlFor, style objects)
2. **useGSAP:** Wrapper z `scope: rootRef` + `inst?.kill?.()` cleanup
3. **scrollRuntime:** Podmiana `window.lenis` na `scrollRuntime.scroll()`
4. **Usunięcie:** Auto-init wrapper, ScrollTrigger.config, window.bookStatsSection
5. **CSS:** Usunięcie @import Google Fonts (jeśli jest)
