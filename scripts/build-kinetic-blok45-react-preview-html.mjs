/**
 * Podgląd HTML z AKTUALNEGO kodu React (KineticEngine + Blok45Engine + scrollRuntime + Bridge).
 * Bez plików *.stack.html.
 *
 * Uruchom: node scripts/build-kinetic-blok45-react-preview-html.mjs
 * Wynik:   preview-html/kinetic-blok45-lp-react/ (index.html + preview-app.js + CSS inline + obrazy public)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const outDir = path.join(ROOT, 'preview-html/kinetic-blok45-lp-react');
const entry = path.join(ROOT, 'scripts/preview/kinetic-blok45-react-entry.tsx');
const jsOut = path.join(outDir, 'preview-app.js');
const kineticCss = path.join(ROOT, 'src/sections/kinetic/kinetic-section.css');
const blokCss = path.join(ROOT, 'src/sections/block-45/blok-4-5-section.css');
const lenisCssPath = path.join(ROOT, 'node_modules/lenis/dist/lenis.css');

const IMAGES = [
  'Ludzie.avif',
  'Ludzie.webp',
  'Ludzie-Small.avif',
  'Ludzie-Small.webp',
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    outfile: jsOut,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    alias: {
      '@': path.join(ROOT, 'src'),
    },
    loader: { '.css': 'empty' },
    logLevel: 'info',
  });

  const lenisCss = fs.existsSync(lenisCssPath)
    ? fs.readFileSync(lenisCssPath, 'utf8')
    : '/* lenis.css missing — run npm install */\n';

  const css = [kineticCss, blokCss]
    .map((p) => fs.readFileSync(p, 'utf8'))
    .join('\n\n');

  /** Jak layout LP: lenis.css + globals @layer base (main, overscroll) + brak „pudełka” pod React. */
  const previewShellCss = `
${lenisCss}
    *, *::before, *::after { box-sizing: border-box; }
    html {
      font-size: 16px;
      scrollbar-gutter: stable;
      overflow-x: clip;
      /* next/font na LP — sekcje używają var(--font-brand, …) */
      --font-brand: 'Lexend', ui-sans-serif, system-ui, sans-serif;
      --font-serif: Georgia, 'Times New Roman', ui-serif, serif;
      --font-owocni-form: 'Lexend', ui-sans-serif, system-ui, sans-serif;
    }
    html, body { overscroll-behavior: none; margin: 0; }
    body {
      background-color: #f7f6f4;
      overflow-x: clip;
      font-family: var(--font-brand);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    /* LP: body > … > main — bez dodatkowego bloku layoutu między body a main */
    #preview-app-root { display: contents; }
    main {
      max-width: 100%;
      overflow-x: clip;
    }
`;

  const html = `<!DOCTYPE html>
<!-- Wygenerowano: node scripts/build-kinetic-blok45-react-preview-html.mjs — React (KineticEngine, Blok45Engine), bez *.stack.html -->
<!-- Serwuj katalog (np. npx serve .) — file:// może blokować moduły / CORS. -->
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kinetic + Blok 4–5 — podgląd z React</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap" rel="stylesheet">
  <style>
${previewShellCss}
${css}
  </style>
</head>
<body>
  <div id="preview-app-root"></div>
  <script src="./preview-app.js" defer></script>
</body>
</html>
`;

  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

  const pub = path.join(ROOT, 'public');
  for (const name of IMAGES) {
    const from = path.join(pub, name);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(outDir, name));
    }
  }

  const stat = fs.statSync(jsOut);
  console.log('Wrote', path.join(outDir, 'index.html'));
  console.log('Wrote', jsOut, '(' + Math.round(stat.size / 1024) + ' KB)');
  console.log('Obrazy skopiowane do:', outDir);
  console.log('Podgląd: cd preview-html/kinetic-blok45-lp-react && npx --yes serve .');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
