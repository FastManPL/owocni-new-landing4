#!/usr/bin/env node
/**
 * Kopiuje zdjęcia trail do public/trail/ z wymaganym nazewnictwem hero.
 *
 * Oczekiwane nazwy w public/trail/ (sekcja hero):
 *   {A1..A4,B1..B4,C1..C4,D1..D4}_strrona_internetowa.avif | .webp
 *   oraz warianty _RETINA: ..._strrona_internetowa_RETINA.avif | .webp
 *
 * Użycie:
 *   node scripts/copy-trail-images.js <katalog_źródłowy>
 *
 * Konwencje w katalogu źródłowym (obsługiwane):
 *   1) Już poprawne: A1_strrona_internetowa.avif → kopiuj 1:1
 *   2) Krótkie: A1.avif, A1.webp → kopiuj jako A1_strrona_internetowa.avif
 *   3) Numerowane: 01.avif .. 16.avif → mapuj na A1..A4,B1..B4,C1..C4,D1..D4
 */

const fs = require('fs');
const path = require('path');

const KEYS = ['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4','D1','D2','D3','D4'];
const BASENAME = '_strrona_internetowa';
const EXTS = ['avif', 'webp'];
const RETINA_SUFFIX = '_RETINA';

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'public', 'trail');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log('  OK', path.basename(dest));
}

function main() {
  const srcDir = process.argv[2];
  if (!srcDir || !fs.existsSync(srcDir)) {
    console.error('Użycie: node scripts/copy-trail-images.js <katalog_źródłowy>');
    console.error('Przykład: node scripts/copy-trail-images.js ./KATALOG');
    process.exit(1);
  }

  const src = path.resolve(projectRoot, srcDir);
  if (!fs.statSync(src).isDirectory()) {
    console.error('Ścieżka musi być katalogiem:', src);
    process.exit(1);
  }

  ensureDir(outDir);
  const files = fs.readdirSync(src);
  let copied = 0;

  for (const key of KEYS) {
    const base = `${key}${BASENAME}`;
    for (const ext of EXTS) {
      const targetName = `${base}.${ext}`;
      const targetPath = path.join(outDir, targetName);

      // 1) Plik już ma docelową nazwę
      const srcExact = path.join(src, targetName);
      if (fs.existsSync(srcExact)) {
        copyFile(srcExact, targetPath);
        copied++;
        continue;
      }

      // 2) Krótka nazwa: A1.avif
      const srcShort = path.join(src, `${key}.${ext}`);
      if (fs.existsSync(srcShort)) {
        copyFile(srcShort, targetPath);
        copied++;
        continue;
      }

      // 3) Numer 01..16 (index 0-based: 01 -> A1, 16 -> D4)
      const idx = KEYS.indexOf(key);
      const num = String(idx + 1).padStart(2, '0');
      const srcNum = path.join(src, `${num}.${ext}`);
      if (fs.existsSync(srcNum)) {
        copyFile(srcNum, targetPath);
        copied++;
      }
    }

    // Retina (opcjonalnie)
    for (const ext of EXTS) {
      const targetNameRetina = `${base}${RETINA_SUFFIX}.${ext}`;
      const targetPathRetina = path.join(outDir, targetNameRetina);
      const srcExactR = path.join(src, targetNameRetina);
      const srcShortR = path.join(src, `${key}${RETINA_SUFFIX}.${ext}`);
      const idx = KEYS.indexOf(key);
      const num = String(idx + 1).padStart(2, '0');
      const srcNumR = path.join(src, `${num}_RETINA.${ext}`);

      if (fs.existsSync(srcExactR)) {
        copyFile(srcExactR, targetPathRetina);
        copied++;
      } else if (fs.existsSync(srcShortR)) {
        copyFile(srcShortR, targetPathRetina);
        copied++;
      } else if (fs.existsSync(srcNumR)) {
        copyFile(srcNumR, targetPathRetina);
        copied++;
      }
    }
  }

  console.log('\nGotowe. Skopiowano plików:', copied);
  console.log('Docelowy katalog:', outDir);
}

main();
