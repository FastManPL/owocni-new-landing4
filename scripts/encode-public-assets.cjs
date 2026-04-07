/**
 * Konwertuje PNG/JPEG w public/assets na natywne .webp + .avif i usuwa oryginały.
 * GIF i inne formaty są pomijane. favicon/ i manifesty poza assets nie są dotykane.
 *
 * Uruchomienie: node scripts/encode-public-assets.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'public', 'assets');

function walk(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out = out.concat(walk(p));
    else if (/^\._/.test(name) || name === '.DS_Store') continue;
    else if (/\.(png|jpe?g)$/i.test(name)) out.push(p);
  }
  return out;
}

async function main() {
  const files = walk(assetsDir);
  if (files.length === 0) {
    console.log('Brak plików PNG/JPEG w public/assets.');
    return;
  }
  for (const abs of files) {
    const input = await sharp(abs).toBuffer();
    const base = abs.replace(/\.(png|jpe?g)$/i, '');
    await sharp(input).webp({ quality: 82, effort: 6 }).toFile(`${base}.webp`);
    await sharp(input).avif({ quality: 55, effort: 4 }).toFile(`${base}.avif`);
    await fs.promises.unlink(abs);
    console.log('OK', path.relative(root, abs));
  }
  console.log(`\nZrobione: ${files.length} plików → .webp + .avif, oryginały usunięte.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
