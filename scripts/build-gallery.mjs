import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
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
const placeholderSrc = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

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

const getImageDimensions = (imagePath) => {
  const result = spawnSync(
    'sips',
    ['-g', 'pixelWidth', '-g', 'pixelHeight', imagePath],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to read dimensions for ${imagePath}`);
  }

  const widthMatch = result.stdout.match(/pixelWidth:\s+(\d+)/);
  const heightMatch = result.stdout.match(/pixelHeight:\s+(\d+)/);

  if (!widthMatch || !heightMatch) {
    throw new Error(`Could not parse image dimensions for ${imagePath}`);
  }

  return {
    width: Number(widthMatch[1]),
    height: Number(heightMatch[1]),
  };
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
    const { width, height } = getImageDimensions(webSrc);

    return [
      `${figureIndent}<figure class="shot">`,
      `${innerIndent}<button class="shot-trigger" aria-label="Open photo">`,
      `${innerIndent}  <img src="${placeholderSrc}" data-src="${escapeHtml(webSrc)}" width="${width}" height="${height}" alt="${escapeHtml(alt)}" decoding="async" />`,
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
