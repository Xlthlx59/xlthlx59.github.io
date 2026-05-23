import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(rootDir, 'photos.json');
const indexPath = path.join(rootDir, 'index.html');
const sourceDir = path.join(rootDir, 'photos');
const webDir = path.join(rootDir, 'photos-web');
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

const getWebSrc = (src) => {
  const absoluteSourcePath = path.join(rootDir, src);
  const relativePhotoPath = path.relative(sourceDir, absoluteSourcePath);

  if (relativePhotoPath.startsWith('..') || path.isAbsolute(relativePhotoPath)) {
    throw new Error(`Photo must live inside photos/: ${src}`);
  }

  const webSrc = path.posix.join('photos-web', relativePhotoPath.split(path.sep).join('/'));
  const webPath = path.join(webDir, relativePhotoPath);

  if (!existsSync(webPath)) {
    throw new Error(`Optimized photo not found: ${webSrc}. Run node scripts/build-site.mjs.`);
  }

  return webSrc;
};

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

    const webSrc = getWebSrc(src);

    return [
      `${figureIndent}<figure class="shot">`,
      `${innerIndent}<button class="shot-trigger" aria-label="Open photo">`,
      `${innerIndent}  <img src="${escapeHtml(webSrc)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`,
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
