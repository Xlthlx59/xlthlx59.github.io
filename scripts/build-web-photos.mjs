import { mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '..');
const manifestPath = path.join(rootDir, 'photos.json');
const sourceDir = path.join(rootDir, 'photos');
const outputDir = path.join(rootDir, 'photos-web');
const thumbnailDir = path.join(rootDir, 'photos-thumbs');
const outputs = [
  {
    label: 'full',
    dir: outputDir,
    maxDimension: 2000,
    jpegQuality: 82,
  },
  {
    label: 'thumbnail',
    dir: thumbnailDir,
    maxDimension: 700,
    jpegQuality: 62,
  },
];

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (!Array.isArray(manifest) || manifest.length === 0) {
  throw new Error('photos.json must contain at least one photo.');
}

await Promise.all(outputs.map((output) => mkdir(output.dir, { recursive: true })));

const getPhotoSrc = (entry, index) => {
  const photo = typeof entry === 'string' ? { src: entry } : entry;
  const src = typeof photo.src === 'string' ? photo.src.trim() : '';

  if (!src) {
    throw new Error(`Missing src for photo at position ${index + 1}.`);
  }

  return src;
};

const toOutputPaths = (src) => {
  const absoluteSourcePath = path.join(rootDir, src);
  const relativePhotoPath = path.relative(sourceDir, absoluteSourcePath);

  if (relativePhotoPath.startsWith('..') || path.isAbsolute(relativePhotoPath)) {
    throw new Error(`Photo must live inside photos/: ${src}`);
  }

  return {
    sourcePath: absoluteSourcePath,
    outputPaths: outputs.map((output) => ({
      ...output,
      outputPath: path.join(output.dir, relativePhotoPath),
    })),
  };
};

const counts = new Map(outputs.map((output) => [output.label, { generated: 0, skipped: 0 }]));
const scriptMtimeMs = statSync(scriptPath).mtimeMs;

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

for (const [index, entry] of manifest.entries()) {
  const src = getPhotoSrc(entry, index);
  const { sourcePath, outputPaths } = toOutputPaths(src);

  if (!existsSync(sourcePath)) {
    throw new Error(`Photo not found: ${src}`);
  }

  const sourceDimensions = getImageDimensions(sourcePath);
  const sourceMaxDimension = Math.max(sourceDimensions.width, sourceDimensions.height);
  const inputMtimeMs = Math.max(statSync(sourcePath).mtimeMs, scriptMtimeMs);

  for (const { label, outputPath, maxDimension, jpegQuality } of outputPaths) {
    const count = counts.get(label);
    const outputIsCurrent =
      existsSync(outputPath) && statSync(outputPath).mtimeMs >= inputMtimeMs;

    if (outputIsCurrent) {
      count.skipped += 1;
      continue;
    }

    await mkdir(path.dirname(outputPath), { recursive: true });

    const targetMaxDimension = Math.min(maxDimension, sourceMaxDimension);
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
        String(targetMaxDimension),
        sourcePath,
        '--out',
        outputPath,
      ],
      { encoding: 'utf8' },
    );

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `Failed to optimize ${src}`);
    }

    count.generated += 1;
  }
}

for (const [label, { generated, skipped }] of counts) {
  console.log(`${label} photos ready: ${generated} generated, ${skipped} skipped.`);
}
