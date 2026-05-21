import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(rootDir, 'photos.json');
const indexPath = path.join(rootDir, 'index.html');
const galleryPattern = /<!-- gallery:start -->[\s\S]*?<!-- gallery:end -->/;

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (!Array.isArray(manifest) || manifest.length === 0) {
  throw new Error('photos.json must contain at least one photo.');
}

const figureIndent = '          ';
const innerIndent = '            ';

const figures = manifest
  .map((entry, index) => {
    const photo = typeof entry === 'string' ? { src: entry, alt: '' } : entry;
    const src = typeof photo.src === 'string' ? photo.src.trim() : '';
    const alt = typeof photo.alt === 'string' ? photo.alt : '';

    if (!src) {
      throw new Error(`Missing src for photo at position ${index + 1}.`);
    }

    const absolutePath = path.join(rootDir, src);
    if (!existsSync(absolutePath)) {
      throw new Error(`Photo not found: ${src}`);
    }

    return [
      `${figureIndent}<figure class="shot">`,
      `${innerIndent}<button class="shot-trigger" aria-label="Open photo">`,
      `${innerIndent}  <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />`,
      `${innerIndent}</button>`,
      `${figureIndent}</figure>`,
    ].join('\n');
  })
  .join('\n');

const indexHtml = await readFile(indexPath, 'utf8');

if (!galleryPattern.test(indexHtml)) {
  throw new Error('Could not find gallery markers in index.html.');
}

const nextIndexHtml = indexHtml.replace(
  galleryPattern,
  `<!-- gallery:start -->\n${figures}\n          <!-- gallery:end -->`,
);

await writeFile(indexPath, nextIndexHtml);
