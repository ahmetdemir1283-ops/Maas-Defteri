// dist/ çıktısını tek bir HTML dosyasına dönüştürür.
// Kullanım: npm run build:single  (önce vite build çalışır)
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'single-file');
const source = path.join(dist, 'index.html');

if (!existsSync(source)) {
  console.error('dist/index.html bulunamadı. Önce `npm run build` çalıştırın.');
  process.exit(1);
}

function assetFile(url) {
  const clean = url
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\.?\//, '')
    .split(/[?#]/)[0];
  return path.join(dist, clean);
}

let html = await readFile(source, 'utf8');

// 1) CSS dosyalarını <style> olarak göm.
for (const tag of html.match(/<link[^>]*rel="stylesheet"[^>]*>/g) ?? []) {
  const href = /href="([^"]+)"/.exec(tag)?.[1];
  if (!href) continue;
  const css = await readFile(assetFile(href), 'utf8');
  html = html.replace(tag, () => `<style>\n${css.trim()}\n</style>`);
}

// 2) JS paketini module script olarak göm.
const scriptTag = /<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/.exec(html);
if (!scriptTag) {
  console.error('dist/index.html içinde module script bulunamadı.');
  process.exit(1);
}
const js = (await readFile(assetFile(scriptTag[1]), 'utf8')).replace(/<\/script/gi, '<\\/script');
html = html.replace(scriptTag[0], () => `<script type="module">\n${js}\n</script>`);

// 3) Tek dosyada anlamı olmayan dış referansları kaldır.
html = html
  .replace(/<link[^>]*rel="modulepreload"[^>]*>\s*/g, '')
  .replace(/<link[^>]*rel="manifest"[^>]*>\s*/g, '')
  .replace(/<link[^>]*rel="apple-touch-icon"[^>]*>\s*/g, '')
  .replace(/<link[^>]*rel="icon"[^>]*>\s*/g, '');

// 4) Küçük, gömülü bir favicon ekle (404 isteği olmasın).
const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23121214'/%3E%3Cpath d='M20 16h24v32H20z' fill='none' stroke='%23f59e0b' stroke-width='4'/%3E%3Cpath d='M26 28h12M26 36h8' stroke='%23f59e0b' stroke-width='4'/%3E%3C/svg%3E";
html = html.replace('</head>', () => `    <link rel="icon" href="${favicon}" />\n  </head>`);

// Gömülen pakette dış script/link kalmadığını doğrula.
if (/<script[^>]*\ssrc=/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ''))) {
  console.error('Tek dosyada dış script referansı kaldı.');
  process.exit(1);
}

const markupOnly = html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '');
const leftovers = markupOnly.match(/<(?:link|script|img|source)[^>]*(?:src|href)="(?!data:|https?:)[^"]+"/g) ?? [];
if (leftovers.length) {
  console.error('Tek dosyada kalan dış referanslar:', leftovers.join(', '));
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const target = path.join(outDir, 'index.html');
await writeFile(target, html, 'utf8');

const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
console.log(`Tek dosya hazır: ${path.relative(root, target)} (${kb} KB)`);
