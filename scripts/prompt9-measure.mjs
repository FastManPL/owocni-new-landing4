import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve('artifacts/prompt9');

const TRACE_CATEGORIES = [
  '-*',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'v8',
  'disabled-by-default-v8.compile',
  'blink.user_timing',
  'loading',
  'toplevel',
];

async function ensureDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

function ms(dur) {
  return typeof dur === 'number' ? dur / 1000 : 0;
}

function sumDur(events, names) {
  return events
    .filter((e) => e.ph === 'X' && names.has(e.name) && typeof e.dur === 'number')
    .reduce((acc, e) => acc + ms(e.dur), 0);
}

function topDurations(events, names, limit = 10) {
  return events
    .filter((e) => e.ph === 'X' && names.has(e.name) && typeof e.dur === 'number')
    .map((e) => ({ name: e.name, ms: ms(e.dur), ts: e.ts }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limit);
}

function topScriptByUrl(events, limit = 20) {
  const map = new Map();
  for (const e of events) {
    if (e.ph !== 'X' || e.name !== 'EvaluateScript') continue;
    const url = e.args?.data?.url || e.args?.url || '(inline/unknown)';
    const prev = map.get(url) || 0;
    map.set(url, prev + ms(e.dur));
  }
  return [...map.entries()]
    .map(([url, total_ms]) => ({ url, total_ms }))
    .sort((a, b) => b.total_ms - a.total_ms)
    .slice(0, limit);
}

function extractScriptTiming(events) {
  const parseNames = new Set(['v8.parseOnBackground', 'V8.Parse', 'ParseScript']);
  const compileNames = new Set(['V8.CompileCode', 'v8.compile', 'CompileScript']);
  const execNames = new Set(['EvaluateScript', 'FunctionCall', 'RunMicrotasks']);

  return {
    parse_ms: sumDur(events, parseNames),
    compile_ms: sumDur(events, compileNames),
    execution_ms: sumDur(events, execNames),
    top_execution_tasks: topDurations(events, execNames, 15),
    top_script_execution_by_url: topScriptByUrl(events, 20),
  };
}

function extractImageDecode(events) {
  const decodeNames = new Set(['Decode Image', 'ImageDecodeTask']);
  return {
    total_decode_ms: sumDur(events, decodeNames),
    top_decode_tasks: topDurations(events, decodeNames, 10),
  };
}

function extractHydrationSignals(events) {
  const userTiming = events.filter((e) => e.cat?.includes('blink.user_timing'));
  const hydration = userTiming.filter((e) =>
    String(e.name).toLowerCase().includes('hydrat') || String(e.name).toLowerCase().includes('next')
  );
  return {
    user_timing_hydration_mark_count: hydration.length,
    hydration_marks_sample: hydration.slice(0, 20).map((e) => ({ name: e.name, ph: e.ph, ts: e.ts })),
  };
}

function extractInteractionDispatch(events) {
  const dispatch = events
    .filter((e) => e.ph === 'X' && e.name === 'EventDispatch' && typeof e.dur === 'number')
    .map((e) => ({
      type: e.args?.data?.type || 'unknown',
      ms: ms(e.dur),
      ts: e.ts,
    }))
    .filter((e) => ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'keydown'].includes(e.type));

  const byType = {};
  for (const row of dispatch) {
    byType[row.type] = byType[row.type] || { count: 0, total_ms: 0, max_ms: 0 };
    byType[row.type].count += 1;
    byType[row.type].total_ms += row.ms;
    byType[row.type].max_ms = Math.max(byType[row.type].max_ms, row.ms);
  }

  return {
    events_top: dispatch.sort((a, b) => b.ms - a.ms).slice(0, 20),
    by_type: byType,
  };
}

async function startTracing(cdp) {
  await cdp.send('Tracing.start', {
    transferMode: 'ReturnAsStream',
    traceConfig: {
      recordMode: 'recordContinuously',
      includedCategories: TRACE_CATEGORIES,
    },
  });
}

async function stopTracing(cdp) {
  const tracingComplete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await tracingComplete;

  let trace = '';
  while (true) {
    const { data, eof } = await cdp.send('IO.read', { handle: stream });
    trace += data;
    if (eof) break;
  }
  await cdp.send('IO.close', { handle: stream });
  return JSON.parse(trace);
}

async function getHeapUsage(cdp) {
  const { usedSize, totalSize } = await cdp.send('Runtime.getHeapUsage');
  return { usedSize, totalSize };
}

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) > 0) {
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ timeout: 7000 });
    return true;
  }
  return false;
}

async function runScenario({ eagerWistia }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Page.enable');

  let bfcacheNotUsed = null;
  cdp.on('Page.backForwardCacheNotUsed', (payload) => {
    bfcacheNotUsed = payload;
  });

  await startTracing(cdp);
  const heapStart = await getHeapUsage(cdp);

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  if (eagerWistia) {
    await page.evaluate(() => {
      const append = (src, type) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        if (type) s.type = type;
        document.head.appendChild(s);
      };
      append('https://fast.wistia.com/player.js');
      append('https://fast.wistia.com/embed/kmqidz4bso.js', 'module');
    });
    await page.waitForTimeout(2500);
  }

  await page.mouse.wheel(0, 1800);
  await page.waitForTimeout(500);
  await clickIfVisible(page, '#wyniki-cta');
  await page.waitForTimeout(1200);
  await clickIfVisible(page, '.wp-close-text');
  await page.waitForTimeout(600);

  const heapMid = await getHeapUsage(cdp);

  await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(700);

  const heapEnd = await getHeapUsage(cdp);
  const perfMetrics = await cdp.send('Performance.getMetrics');

  const trace = await stopTracing(cdp);
  const events = trace.traceEvents || [];
  const interactionDispatch = extractInteractionDispatch(events);

  await browser.close();

  const result = {
    scenario: eagerWistia ? 'eager-wistia' : 'lazy-wistia',
    script_timing: extractScriptTiming(events),
    image_decode: extractImageDecode(events),
    hydration_signals: extractHydrationSignals(events),
    interaction_dispatch: interactionDispatch,
    heap: {
      start: heapStart,
      mid: heapMid,
      end: heapEnd,
      growth_mid_minus_start: heapMid.usedSize - heapStart.usedSize,
      growth_end_minus_start: heapEnd.usedSize - heapStart.usedSize,
    },
    detached_script_states: Object.fromEntries(perfMetrics.metrics.map((m) => [m.name, m.value]))
      .DetachedScriptStates,
    bfcache_not_used: bfcacheNotUsed,
    perf_metrics: Object.fromEntries(perfMetrics.metrics.map((m) => [m.name, m.value])),
  };

  await fs.writeFile(path.join(OUT_DIR, `${result.scenario}.json`), JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  await ensureDir();
  const lazy = await runScenario({ eagerWistia: false });
  const eager = await runScenario({ eagerWistia: true });

  const summary = {
    generated_at: new Date().toISOString(),
    lazy_file: 'lazy-wistia.json',
    eager_file: 'eager-wistia.json',
    comparison: {
      script_parse_ms_delta_eager_minus_lazy: eager.script_timing.parse_ms - lazy.script_timing.parse_ms,
      script_compile_ms_delta_eager_minus_lazy: eager.script_timing.compile_ms - lazy.script_timing.compile_ms,
      script_execution_ms_delta_eager_minus_lazy: eager.script_timing.execution_ms - lazy.script_timing.execution_ms,
      max_click_dispatch_ms_delta_eager_minus_lazy:
        (eager.interaction_dispatch.by_type.click?.max_ms || 0) -
        (lazy.interaction_dispatch.by_type.click?.max_ms || 0),
      heap_growth_mid_delta_eager_minus_lazy:
        eager.heap.growth_mid_minus_start - lazy.heap.growth_mid_minus_start,
      image_decode_ms_delta_eager_minus_lazy:
        eager.image_decode.total_decode_ms - lazy.image_decode.total_decode_ms,
      detached_script_states_delta:
        (eager.detached_script_states || 0) - (lazy.detached_script_states || 0),
    },
  };

  await fs.writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
