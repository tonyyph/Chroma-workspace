#!/usr/bin/env node
/**
 * Builds the Chroma Wave production asset system from the geometry published in
 * `Chroma Wave Final Concept.dc.html` — CONCEPT 07 · CHROMA SIGNAL · V1 · JUL 2026.
 *
 *   node tools/brand-assets/src/generate.mjs [--out <dir>] [--group <a,b>] [--concurrency <n>]
 *
 * The tree mirrors the section 09 EXPORT CHECKLIST. One mark, no alternates.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { appIconSizes, buildForSize, builds, channelSizes, channels, tiers } from './builds.mjs';
import { lottieFiles } from './lottie.mjs';
import { adaptiveForeground, geometryPlate, palette, symbol } from './mark.mjs';
import { defaultConcurrency, runRenderJobs } from './pool.mjs';
import {
  emptyGlyph,
  emptyGlyphNames,
  onboardingPanel,
  seedDot,
  shareCard,
  shareRatios,
  splashField,
  splashFrame,
} from './scenes.mjs';
import { soundNames, sounds } from './sound.mjs';
import { wordmark, wordmarkVariants } from './wordmark.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_OUT = join(ROOT, 'apps/mobile/assets/brand');

const FONT = {
  fontDirs: ['/System/Library/Fonts', '/Library/Fonts', '/usr/share/fonts'],
  loadSystemFonts: true,
  defaultFontFamily: 'Helvetica Neue',
};

const written = [];

/**
 * Rasterisation is queued rather than executed. `Resvg.render()` is synchronous, so
 * awaiting each file in turn pins the build to a single core; collecting the jobs first
 * lets the worker pool spread ~190ms of render time per image across every core.
 */
const renderJobs = [];

/** SVG writes need no worker, but must still be settled before the manifest is counted. */
const pendingWrites = [];

async function put(path, buffer) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  written.push({ path: relative(ROOT, path), bytes: buffer.length });
}

const putSvg = (path, source) => {
  pendingWrites.push(put(path, Buffer.from(source, 'utf8')));
};

/** Opaque PNG, sRGB, alpha removed — the store rejects icons with alpha. */
const flatPng = (path, svg, width, background) =>
  renderJobs.push({ path, svg, width, format: 'flat', background });

const alphaPng = (path, svg, width) => renderJobs.push({ path, svg, width, format: 'alpha' });

const webp = (path, svg, width) => renderJobs.push({ path, svg, width, format: 'webp' });

/* ------------------------------------------------------------------- icons */

function emitIcons(out) {
  // "icon/master.svg · 1024 squircle, bands as strokes"
  putSvg(join(out, 'icon', 'master.svg'), builds.primary.draw());
  putSvg(join(out, 'icon', 'geometry.svg'), geometryPlate());
  for (const [name, build] of Object.entries(builds)) {
    putSvg(join(out, 'icon', `${name}.svg`), build.draw());
  }
  putSvg(join(out, 'icon', 'symbol.svg'), symbol());
  putSvg(join(out, 'icon', 'symbol-light.svg'), symbol({ theme: 'light' }));

  // "ios/AppIcon.appiconset · 1024 + 180/120/87/80/60/58/40/29"
  for (const variant of Object.keys(builds)) {
    for (const size of appIconSizes) {
      const build = buildForSize(variant, size);
      flatPng(
        join(out, 'ios', 'AppIcon.appiconset', `icon-${variant}-${size}.png`),
        build.draw(),
        size,
        build.background,
      );
    }
  }

  // iOS 18+ appearance layers. Tinted is the mono cut on transparent, so the
  // system applies its own ramp rather than tinting an already-grey field.
  for (const size of [1024, 180, 120]) {
    alphaPng(
      join(out, 'ios', 'AppIcon.appiconset', `icon-tinted-${size}.png`),
      symbol({ mono: true, k: 'TI' }),
      size,
    );
  }

  for (const [name, build] of Object.entries(channels)) {
    for (const size of channelSizes) {
      flatPng(
        join(out, 'ios', 'channels', `icon-${name}-${size}.png`),
        build.draw(),
        size,
        build.background,
      );
    }
  }

  // "android/ic_launcher · foreground 432 in 108dp, adaptive safe 66dp"
  alphaPng(join(out, 'android', 'ic_launcher_foreground.png'), adaptiveForeground(), 432);
  // "android/monochrome · themed-icon layer, MONO variant"
  alphaPng(
    join(out, 'android', 'ic_launcher_monochrome.png'),
    adaptiveForeground({ mono: true }),
    432,
  );
  flatPng(
    join(out, 'android', 'ic_launcher_legacy.png'),
    builds.primary.draw(),
    512,
    builds.primary.background,
  );

  // "web/favicon.svg + 180 apple-touch + maskable 512"
  putSvg(join(out, 'web', 'favicon.svg'), builds.small.draw());
  flatPng(join(out, 'web', 'favicon-48.png'), builds.small.draw(), 48, builds.small.background);
  flatPng(
    join(out, 'web', 'apple-touch-180.png'),
    builds.primary.draw(),
    180,
    builds.primary.background,
  );
  flatPng(
    join(out, 'web', 'maskable-512.png'),
    builds.primary.draw(),
    512,
    builds.primary.background,
  );
}

/* ------------------------------------------------------------------ splash */

const SPLASH_WIDTH = 390;

function emitSplash(out) {
  const dir = join(out, 'splash');

  // Storyboard reference renders. Motion is Reanimated + Skia at runtime, so
  // these document the sequence rather than ship as frames.
  for (let i = 1; i <= 6; i++) {
    alphaPng(join(dir, 'frames', `frame-0${i}.png`), splashFrame(i), SPLASH_WIDTH * 2);
  }

  // The native pre-JS screen. Section 06 is explicit that there is no logo
  // hold, so this is frame 01's field; the runtime draws the seed dot and takes
  // over on first paint.
  alphaPng(join(dir, 'launch-field.png'), splashField(), 1242);
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    alphaPng(join(dir, `seed-dot${suffix}.png`), seedDot(), 24 * scale);
    alphaPng(join(dir, `mark${suffix}.png`), symbol(), 200 * scale);
  }

  // expo-splash-screen rescales one source itself rather than reading @2x/@3x.
  alphaPng(join(dir, 'splash-source.png'), symbol(), 1024);
}

/* ------------------------------------------------------- onboarding & states */

function emitOnboarding(out) {
  const names = ['welcome', 'capture', 'tune', 'share', 'permissions'];
  for (let i = 1; i <= 5; i++) {
    alphaPng(
      join(out, 'onboarding', `0${i}-${names[i - 1]}.png`),
      onboardingPanel(i),
      SPLASH_WIDTH * 2,
    );
    putSvg(join(out, 'onboarding', `0${i}-${names[i - 1]}.svg`), onboardingPanel(i));
  }
}

function emitStates(out) {
  for (const [index, name] of Object.entries(emptyGlyphNames)) {
    putSvg(join(out, 'states', `empty-${name}.svg`), emptyGlyph(Number(index)));
  }
  for (const [name, build] of Object.entries(tiers)) {
    putSvg(join(out, 'states', `tier-${name}.svg`), build.draw());
  }
}

/* ------------------------------------------------------------------ lottie */

/**
 * BUILD KIT · 04. Every JSON ships with a static PNG poster frame of the same
 * name, which is what the reduce-motion path renders instead of playing.
 */
function emitLottie(out) {
  for (const [name, build] of Object.entries(lottieFiles)) {
    const document = build();
    putSvg(join(out, 'lottie', `${name}.json`), `${JSON.stringify(document)}\n`);

    // Poster frames: the empty states already have a drawn glyph, the loops use
    // the static three-band bar the reduce-motion rule prescribes.
    const poster = name.startsWith('empty-')
      ? emptyGlyph(posterGlyph(name))
      : staticBandBar(document.w, document.h);
    alphaPng(join(out, 'lottie', `${name}-poster.png`), poster, document.w * 2);
  }
}

const posterGlyph = (name) =>
  ({ 'empty-library': 1, 'empty-results': 2, 'empty-offline': 3, 'empty-loading': 4 })[name] ?? 1;

/** The reduce-motion substitute: a static three-band bar, drawn flat. */
function staticBandBar(width, height) {
  const barHeight = Math.max(10, Math.round(height * 0.06));
  const gap = Math.round(barHeight * 0.6);
  const totalWidth = Math.round(width * 0.62);
  const x = Math.round((width - totalWidth) / 2);
  const bars = palette.bands
    .map((colour, index) => {
      const y = Math.round(height / 2 - (barHeight * 3 + gap * 2) / 2 + index * (barHeight + gap));
      return `<rect x="${x}" y="${y}" width="${totalWidth}" height="${barHeight}" rx="${barHeight / 2}" fill="${colour}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${bars}</svg>`;
}

/* ------------------------------------------------------------------- sound */

/**
 * BUILD KIT · 05. Synthesised, so the cues carry no licence.
 *
 * WAV is the source of truth; CAF is transcoded from it with macOS's own
 * `afconvert` when available, because the kit asks for `.caf`. The WAV is kept
 * alongside so a build on a machine without `afconvert` still has playable audio.
 */
async function emitSound(out) {
  for (const name of soundNames) {
    const wavPath = join(out, 'sound', `${name}.wav`);
    await put(wavPath, sounds[name]());

    const cafPath = join(out, 'sound', `${name}.caf`);
    try {
      // ima4 at 44.1kHz mono — the format iOS decodes cheapest for short cues.
      execFileSync('afconvert', ['-f', 'caff', '-d', 'ima4@44100', '-c', '1', wavPath, cafPath], {
        stdio: 'ignore',
      });
      const { size } = await stat(cafPath);
      written.push({ path: relative(ROOT, cafPath), bytes: size });
    } catch {
      // afconvert is macOS-only. The WAV above is the fallback.
      cafSkipped.push(name);
    }
  }
}

const cafSkipped = [];

/* ---------------------------------------------------------------- wordmark */

/**
 * Section 6: `wordmark/horizontal · stacked · ink-1c (SVG + PNG@3x)`.
 *
 * Real outlines, extracted from the same Space Grotesk file the app renders with,
 * so the "never live text" requirement from the font-licence note is satisfied
 * rather than deferred.
 */
function emitWordmark(out) {
  for (const variant of wordmarkVariants) {
    const source = wordmark(variant);
    putSvg(join(out, 'wordmark', `wordmark-${variant}.svg`), source);
    alphaPng(join(out, 'wordmark', `wordmark-${variant}@3x.png`), source, 1200);
  }
}

/* -------------------------------------------------------------- share cards */

function emitSocial(out) {
  for (const ratio of Object.keys(shareRatios)) {
    const { width } = shareRatios[ratio];
    const source = shareCard(ratio);
    webp(join(out, 'social', `share-${ratio}.webp`), source, width);
    putSvg(join(out, 'social', `share-${ratio}.svg`), source);
  }
}

/* ------------------------------------------------------------------ runtime */

/**
 * The handful of rasters the app itself imports, kept apart from the export
 * tree so Metro never pulls in the full size ladder.
 */
function emitRuntime(out) {
  const dir = join(out, 'runtime');
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    alphaPng(join(dir, `symbol${suffix}.png`), symbol(), 128 * scale);
    alphaPng(join(dir, `icon${suffix}.png`), builds.primary.draw(), 88 * scale);
    alphaPng(join(dir, `tier-free${suffix}.png`), tiers.free.draw(), 96 * scale);
    alphaPng(join(dir, `tier-pro${suffix}.png`), tiers.pro.draw(), 96 * scale);
  }
}

/* -------------------------------------------------------------------- grain */

/** "grain.png · 128px tile, 4% opacity". Deterministic so rebuilds are byte-stable. */
async function emitGrain(out) {
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
  await put(join(out, 'textures', 'grain-128.png'), png);
}

/* --------------------------------------------------------------------- main */

/** Groups exist so an iteration on one asset type does not re-render the rest. */
const GROUPS = {
  icon: emitIcons,
  splash: emitSplash,
  lottie: emitLottie,
  sound: emitSound,
  wordmark: emitWordmark,
  onboarding: emitOnboarding,
  states: emitStates,
  social: emitSocial,
  runtime: emitRuntime,
};

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, groups: Object.keys(GROUPS), concurrency: defaultConcurrency };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = resolve(argv[++i]);
    else if (argv[i] === '--group') args.groups = argv[++i].split(',');
    else if (argv[i] === '--concurrency') args.concurrency = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const started = Date.now();
  const { out, groups, concurrency } = parseArgs(process.argv.slice(2));

  const unknown = groups.find((group) => !(group in GROUPS));
  if (unknown) {
    console.error(`Unknown group "${unknown}". Known: ${Object.keys(GROUPS).join(', ')}`);
    process.exit(1);
  }

  // A partial run must not wipe the groups it is not rebuilding.
  const isFullRun = groups.length === Object.keys(GROUPS).length;
  if (isFullRun) await rm(out, { recursive: true, force: true });

  for (const group of groups) await GROUPS[group](out);
  await Promise.all(pendingWrites);

  const rendered = await runRenderJobs(renderJobs, { font: FONT, concurrency });
  written.push(...rendered.map((f) => ({ path: relative(ROOT, f.path), bytes: f.bytes })));
  if (isFullRun) await emitGrain(out);

  const totalBytes = written.reduce((sum, file) => sum + file.bytes, 0);

  // The manifest describes the whole tree, so a partial run leaves the existing
  // one alone rather than replacing it with a listing of the subset.
  if (isFullRun) {
    const manifest = {
      generatedFrom:
        'Chroma Wave Final Concept.dc.html · CONCEPT 07 · CHROMA SIGNAL · V1 · JUL 2026',
      mark: { number: '07', name: 'Chroma Signal', bands: palette.bands },
      fileCount: written.length,
      totalBytes,
      files: written.map((f) => f.path).sort(),
    };
    await put(join(out, 'manifest.json'), Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  }

  if (cafSkipped.length) {
    console.warn(`afconvert unavailable — CAF not generated for: ${cafSkipped.join(', ')}`);
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `${written.length} files · ${(totalBytes / 1024).toFixed(0)} KB · ${seconds}s · ` +
    `${concurrency} workers · Chroma Signal`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
