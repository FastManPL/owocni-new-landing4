/**
 * Synchronizuje silniki i współdzielony scroll z głównym LP (katalog główny repo).
 * Uruchom z tej paczki: npm run sync
 * Wymaga: paczka leży w repo jako packages/kinetic-blok45-handoff */
import { copyFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, '..');
const LP = path.resolve(PKG, '..', '..');

const files = [
  ['src/lib/scrollRuntime.ts', 'src/lib/scrollRuntime.ts'],
  ['src/components/SmoothScrollProvider.tsx', 'src/components/SmoothScrollProvider.tsx'],
  ['src/app/BridgeSection.tsx', 'src/app/BridgeSection.tsx'],
  ['src/app/BridgeContext.tsx', 'src/app/BridgeContext.tsx'],
  ['src/sections/kinetic/KineticEngine.tsx', 'src/sections/kinetic/KineticEngine.tsx'],
  ['src/sections/kinetic/KineticSection.tsx', 'src/sections/kinetic/KineticSection.tsx'],
  ['src/sections/kinetic/kinetic-section.css', 'src/sections/kinetic/kinetic-section.css'],
  ['src/sections/block-45/Blok45Engine.tsx', 'src/sections/block-45/Blok45Engine.tsx'],
  ['src/sections/block-45/Blok45Section.tsx', 'src/sections/block-45/Blok45Section.tsx'],
  ['src/sections/block-45/blok-4-5-section.css', 'src/sections/block-45/blok-4-5-section.css'],
];

const publicAssets = [
  'Ludzie.webp',
  'Ludzie.avif',
  'Ludzie-Small.webp',
  'Ludzie-Small.avif',
];

async function main() {
  for (const [relFrom, relTo] of files) {
    const from = path.join(LP, relFrom);
    const to = path.join(PKG, relTo);
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
    console.log('cp', relFrom, '->', relTo);
  }
  for (const name of publicAssets) {
    const from = path.join(LP, 'public', name);
    const to = path.join(PKG, 'public', name);
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
    console.log('cp public/', name);
  }
  console.log('Sync OK.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
