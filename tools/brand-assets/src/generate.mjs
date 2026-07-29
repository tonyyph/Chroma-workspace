#!/usr/bin/env node
/**
 * Builds the CHROMAWAVE production asset system for icon concepts 01 (Bandwave)
 * and 07 (Liquid Lens) straight out of the identity document's own geometry.
 *
 *   node tools/brand-assets/src/generate.mjs [--out <dir>] [--concept <id>]
 *
 * Export rules follow PHASE 06 · Production handoff:
 *   - app icons are flat sRGB PNG with no alpha and no pre-applied corner mask
 *   - sizes >= 120 come from the full master, <= 87 from the simplified cut
 *   - splash statics are baked WebP per scale; splash motion stays procedural
 *   - symbols, empty states and premium badges ship as SVG
 */

import { Resvg } from '@resvg/resvg-js';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { alternateIconSizes, appIconSizes, concepts } from './builds.mjs';
import { bandwaveSplash, liquidLensSplash, splashFrame } from './concepts.mjs';
import { emptyStates, premiumAssets } from './system-assets.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_OUT = join(ROOT, 'apps/mobile/assets/brand');

const FONT = {
  fontDirs: ['/System/Library/Fonts', '/Library/Fonts', '/usr/share/fonts'],
  loadSystemFonts: true,
  defaultFontFamily: 'Helvetica Neue',
};

const written = [];

async function put(path, buffer) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  written.push({ path: relative(ROOT, path), bytes: buffer.length });
}

function rasterise(svgSource, width) {
  return new Resvg(svgSource, { fitTo: { mode: 'width', value: width }, font: FONT })
    .render()
    .asPng();
}

/** Opaque PNG, sRGB, alpha removed — the App Store rejects icons with alpha. */
async function flatPng(svgSource, size, background) {
  return sharp(rasterise(svgSource, size))
    .flatten({ background })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .withMetadata({ density: 72 })
    .toBuffer();
}

async function alphaPng(svgSource, width) {
  return sharp(rasterise(svgSource, width)).png({ compressionLevel: 9 }).toBuffer();
}

async function webp(svgSource, width) {
  return sharp(rasterise(svgSource, width)).webp({ quality: 80 }).toBuffer();
}

/* ------------------------------------------------------------------ app icon */

/** Phase 06: ">=120 from the full 4-band master; <=87 from the 3-band simplified cut". */
function buildForSize(concept, variant, size) {
  const useSimplified = size <= concept.simplifiedAtOrBelow;
  if (!useSimplified) return concept.builds[variant];
  const simplifiedName =
    variant === 'primary' || variant === 'dark'
      ? 'small'
      : `small-${variant}` in concept.builds
        ? `small-${variant}`
        : 'small';
  return concept.builds[simplifiedName] ?? concept.builds.small;
}

async function emitAppIcons(concept, outDir) {
  const field = concept.field;
  const opaqueVariants = ['primary', 'dark', 'light', 'mono', 'high-contrast'];

  for (const variant of opaqueVariants) {
    const background = variant === 'light' ? field.light : field.dark;
    for (const size of appIconSizes) {
      const source = buildForSize(concept, variant, size)();
      await put(
        join(outDir, 'app-icon', variant, `chromawave-app-icon-${variant}-${size}.png`),
        await flatPng(source, size, background),
      );
    }
  }

  // iOS 18+ appearance layer: "tinted uses the mono cut on transparent".
  for (const size of [1024, 180, 120]) {
    await put(
      join(outDir, 'app-icon', 'tinted', `chromawave-app-icon-tinted-${size}.png`),
      await alphaPng(concept.builds.tinted(), size),
    );
  }

  // Alternate icons via CFBundleAlternateIcons — 60@2x/60@3x only.
  for (const variant of ['dev', 'beta', 'premium']) {
    for (const size of alternateIconSizes) {
      await put(
        join(outDir, 'app-icon', variant, `chromawave-app-icon-${variant}-${size}.png`),
        await flatPng(concept.builds[variant](), size, field.dark),
      );
    }
  }

  // Android adaptive icon: transparent foreground + monochrome layer.
  await put(
    join(outDir, 'android', 'chromawave-android-foreground.png'),
    await alphaPng(concept.adaptiveForeground(), 432),
  );
  await put(
    join(outDir, 'android', 'chromawave-android-monochrome.png'),
    await alphaPng(concept.builds.tinted(), 432),
  );

  // Web favicon, from the small cut per "FAVICON 16px".
  await put(
    join(outDir, 'app-icon', `chromawave-favicon-48.png`),
    await flatPng(concept.builds.small(), 48, field.dark),
  );
}

/* -------------------------------------------------------------------- splash */

const SPLASH_WIDTH = 390;

/** Storyboard frame 01: "Signal dot fades in, 4px, centre. Field already dark." */
function signalDot() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#FFFFFF"/></svg>';
}

async function emitSplash(concept, outDir) {
  const isBandwave = concept.id === 'bandwave';
  const statics = {
    dark: isBandwave ? bandwaveSplash({ dark: true }) : liquidLensSplash({ dark: true }),
    light: isBandwave ? bandwaveSplash({ dark: false }) : liquidLensSplash(),
  };

  for (const [name, source] of Object.entries(statics)) {
    for (const scale of [1, 2, 3]) {
      const width = SPLASH_WIDTH * scale;
      const suffix = scale === 1 ? '' : `@${scale}x`;
      await put(
        join(outDir, 'splash', 'static', `chromawave-splash-${name}${suffix}.webp`),
        await webp(source, width),
      );
      // expo-splash-screen consumes PNG, so the same bake ships in both formats.
      await put(
        join(outDir, 'splash', 'static', `chromawave-splash-${name}${suffix}.png`),
        await alphaPng(source, width),
      );
    }
  }

  // Logo-only splash: the symbol on transparent, sized for `imageWidth`.
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    await put(
      join(outDir, 'splash', 'static', `chromawave-splash-logo${suffix}.png`),
      await alphaPng(concept.symbol(), 200 * scale),
    );
  }

  // Single high-resolution source for the expo-splash-screen config plugin, which
  // rescales per density itself rather than reading @2x/@3x companions.
  await put(
    join(outDir, 'splash', 'static', 'chromawave-splash-source.png'),
    await alphaPng(concept.symbol(), 1024),
  );

  // REACT NATIVE INTEGRATION: "expo-splash-screen holds frame 01; hide on first paint,
  // then run the sequence in-app so there is no visible seam." Frame 01 is the bare
  // signal dot, so it ships as its own transparent asset at the sizes the config plugin
  // scales against.
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    await put(
      join(outDir, 'splash', 'static', `chromawave-splash-signal${suffix}.png`),
      await alphaPng(signalDot(), 24 * scale),
    );
  }

  // Motion storyboard reference frames — Bandwave owns ASSET SYSTEM · B.
  if (isBandwave) {
    for (let i = 1; i <= 8; i++) {
      await put(
        join(outDir, 'splash', 'frames', `chromawave-splash-frame-0${i}.png`),
        await alphaPng(splashFrame(i), SPLASH_WIDTH * 2),
      );
    }
  }
}

/* ------------------------------------------------- symbols and system assets */

async function emitSymbols(concept, outDir) {
  const symbols = {
    gradient: concept.builds.primary(),
    monochrome: concept.builds.mono(),
    light: concept.builds.light(),
    small: concept.builds.small(),
    transparent: concept.symbol(),
  };
  for (const [name, source] of Object.entries(symbols)) {
    await put(join(outDir, 'symbol', `chromawave-symbol-${name}.svg`), Buffer.from(source, 'utf8'));
  }
}

async function emitSystemAssets(concept, outDir) {
  for (const [name, source] of Object.entries(emptyStates(concept.id))) {
    await put(
      join(outDir, 'empty-states', `chromawave-empty-${name}.svg`),
      Buffer.from(source, 'utf8'),
    );
  }
  for (const [name, source] of Object.entries(premiumAssets(concept.id))) {
    await put(
      join(outDir, 'premium', `chromawave-premium-${name}.svg`),
      Buffer.from(source, 'utf8'),
    );
  }
}

/**
 * Runtime bundle: the handful of rasters the app itself imports, kept apart from
 * the store/Xcode export tree so Metro never pulls in the full ladder.
 */
async function emitRuntime(concept, outRoot) {
  const dir = join(outRoot, 'runtime', concept.id);
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    await put(join(dir, `symbol${suffix}.png`), await alphaPng(concept.symbol(), 128 * scale));
    await put(
      join(dir, `icon-preview${suffix}.png`),
      await alphaPng(concept.builds.primary(), 88 * scale),
    );
    await put(join(dir, `splash-logo${suffix}.png`), await alphaPng(concept.symbol(), 200 * scale));
  }
}

/* -------------------------------------------------------------------- grain */

/** ASSET SYSTEM · G — "grain-128.png · tile · 4%". Deterministic so rebuilds are byte-stable. */
async function emitGrain(outRoot) {
  const size = 128;
  const data = Buffer.alloc(size * size * 4);
  let seed = 0x9e3779b9;
  for (let i = 0; i < size * size; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const value = 128 + ((seed >>> 8) % 127) - 63;
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  const png = await sharp(data, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await put(join(outRoot, 'textures', 'chromawave-grain-128.png'), png);
}

/* --------------------------------------------------------------------- main */

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, concept: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = resolve(argv[++i]);
    else if (argv[i] === '--concept') args.concept = argv[++i];
  }
  return args;
}

async function main() {
  const { out, concept: only } = parseArgs(process.argv.slice(2));
  const selected = Object.values(concepts).filter((c) => !only || c.id === only);
  if (!selected.length) {
    console.error(`Unknown concept "${only}". Known: ${Object.keys(concepts).join(', ')}`);
    process.exit(1);
  }

  for (const concept of selected) {
    const dir = join(out, concept.id);
    await rm(dir, { recursive: true, force: true });
    await emitAppIcons(concept, dir);
    await emitSplash(concept, dir);
    await emitSymbols(concept, dir);
    await emitSystemAssets(concept, dir);
    await emitRuntime(concept, out);
  }
  await emitGrain(out);

  const totalBytes = written.reduce((sum, file) => sum + file.bytes, 0);
  const manifest = {
    generatedFrom: 'CHROMAWAVE Identity.dc.html · BRAND & ICON SYSTEM · V1 · JUL 2026',
    concepts: selected.map((c) => ({
      id: c.id,
      number: c.conceptNumber,
      name: c.name,
      designation: c.designation,
    })),
    fileCount: written.length,
    totalBytes,
    files: written.map((f) => f.path).sort(),
  };
  await put(join(out, 'manifest.json'), Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));

  console.log(
    `${written.length} files · ${(totalBytes / 1024).toFixed(0)} KB · ${selected
      .map((c) => c.name)
      .join(' + ')}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
