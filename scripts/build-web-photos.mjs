import { mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(rootDir, 'photos.json');
const sourceDir = path.join(rootDir, 'photos');
const outputDir = path.join(rootDir, 'photos-web');
const maxDimension = 2000;
const jpegQuality = 82;

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (!Array.isArray(manifest) || manifest.length === 0) {
  throw new Error('photos.json must contain at least one photo.');
}

await mkdir(outputDir, { recursive: true });

const getPhotoSrc = (entry, index) => {
  const photo = typeof entry === 'string' ? { src: entry } : entry;
  const src = typeof photo.src === 'string' ? photo.src.trim() : '';

  if (!src) {
    throw new Error(`Missing src for photo at position ${index + 1}.`);
  }

  return src;
};

const toWebPath = (src) => {
  const absoluteSourcePath = path.join(rootDir, src);
  const relativePhotoPath = path.relative(sourceDir, absoluteSourcePath);

  if (relativePhotoPath.startsWith('..') || path.isAbsolute(relativePhotoPath)) {
    throw new Error(`Photo must live inside photos/: ${src}`);
  }

  return {
    sourcePath: absoluteSourcePath,
    outputPath: path.join(outputDir, relativePhotoPath),
  };
};

let generated = 0;
let skipped = 0;

for (const [index, entry] of manifest.entries()) {
  const src = getPhotoSrc(entry, index);
  const { sourcePath, outputPath } = toWebPath(src);

  if (!existsSync(sourcePath)) {
    throw new Error(`Photo not found: ${src}`);
  }

  const outputIsCurrent =
    existsSync(outputPath) && statSync(outputPath).mtimeMs >= statSync(sourcePath).mtimeMs;

  if (outputIsCurrent) {
    skipped += 1;
    continue;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  const result = spawnSync(
    'sips',
    [
      '-s',
      'format',
      'jpeg',
      '-s',
      'formatOptions',
      String(jpegQuality),
      '-Z',
      String(maxDimension),
      sourcePath,
      '--out',
      outputPath,
    ],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to optimize ${src}`);
  }

  generated += 1;
}

console.log(`Web photos ready: ${generated} generated, ${skipped} skipped.`);
