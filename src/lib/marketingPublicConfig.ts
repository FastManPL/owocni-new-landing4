/**
 * Public marketing / GTM — odczyt wyłącznie NEXT_PUBLIC_* (bezpieczne na serwerze i kliencie).
 * Konstytucja: G7 (dns-prefetch origin loadera), I1 (default consent przed GTM), I7 (GTM przez next/script lazyOnload).
 */

const GTM_DEFAULT_HOST = 'https://www.googletagmanager.com';

function trimEnv(v: string | undefined): string {
  return (v ?? '').trim();
}

/** Pełny URL do `gtm.js` — albo jawny override (np. host sGTM), albo standard Google + id kontenera. */
export function getGtmLazyScriptSrc(): string | null {
  const custom = trimEnv(process.env.NEXT_PUBLIC_GTM_SCRIPT_URL);
  if (custom) return custom;
  const id = trimEnv(process.env.NEXT_PUBLIC_GTM_CONTAINER_ID);
  if (!id) return null;
  return `${GTM_DEFAULT_HOST}/gtm.js?id=${encodeURIComponent(id)}`;
}

/** Origin do `<link rel="dns-prefetch">` (G7 — nie preconnect). */
export function getGtmDnsPrefetchHref(): string | null {
  const src = getGtmLazyScriptSrc();
  if (!src) return null;
  try {
    return new URL(src).origin;
  } catch {
    return null;
  }
}

/** Id kontenera `GTM-…` — iframe noscript + dokumentacja. */
export function getGtmContainerId(): string | null {
  const id = trimEnv(process.env.NEXT_PUBLIC_GTM_CONTAINER_ID);
  if (id) return id;
  const u = trimEnv(process.env.NEXT_PUBLIC_GTM_SCRIPT_URL);
  if (!u) return null;
  try {
    const q = new URL(u).searchParams.get('id');
    return q ? q.trim() : null;
  } catch {
    return null;
  }
}

export function isGtmConfigured(): boolean {
  return getGtmLazyScriptSrc() !== null;
}

/**
 * Inline I1 + kolejka GTM: default consent, potem sygnał startu (przed lazy `gtm.js`).
 * Jedna blacha <script> w <head> — kolejność zgodna z dokumentacją GTM + Consent Mode v2.
 */
export function getGtmHeadBootstrapScriptContent(): string | null {
  if (!isGtmConfigured()) return null;
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'analytics_storage': 'denied',
  'wait_for_update': 500
});
dataLayer.push({'gtm.start': Date.now(), event:'gtm.js'});
`.trim();
}

/** URL iframe noscript — domyślnie origin Google; override gdy hostujesz własny endpoint ns.html. */
export function getGtmNoscriptIframeSrc(): string | null {
  const id = getGtmContainerId();
  if (!id) return null;
  const base = trimEnv(process.env.NEXT_PUBLIC_GTM_NOSCRIPT_ORIGIN) || GTM_DEFAULT_HOST;
  return `${base.replace(/\/$/, '')}/ns.html?id=${encodeURIComponent(id)}`;
}
