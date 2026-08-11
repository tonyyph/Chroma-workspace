import { z } from 'zod';

import { safeForegroundFor } from './color';
import { isColorOnly, type ChromaticMemory } from './memory';
import { hexSchema } from './palette';

/**
 * What a native extension is allowed to know about a memory.
 *
 * **This file is a wire format, not a model.** Everything here crosses out of
 * JavaScript into a WidgetKit or ActivityKit process that has no React Native
 * runtime, no MMKV, no access to the app's documents directory and no way to ask
 * a question. It gets one JSON file in a shared App Group container and must
 * render something correct from whatever it finds there — including nothing.
 *
 * Three rules follow, and every decision below is a consequence of one of them:
 *
 *  1. **The extension never computes.** Contrast, formatting, ranking and
 *     truncation all happen here, where they are tested. A widget that has to
 *     decide whether white or black reads on a colour is a widget that will get
 *     it wrong on somebody's lock screen at 6am.
 *  2. **The extension never fetches.** No remote URL appears in this payload —
 *     see `artworkPath`. WidgetKit renders on a timeline the app does not
 *     control, frequently with no network, and a card that renders a hole is
 *     worse than one that renders a colour.
 *  3. **The extension never learns anything private.** Notes, titles, locations
 *     and tags are absent by construction rather than by filtering. See
 *     `toWidgetSnapshot`.
 *
 * Mirrors `Snapshot.swift`. The two are checked against each other by
 * `snapshot.test.ts`'s Codable-compatibility suite, which is the only thing
 * standing between a renamed field here and a blank widget in production.
 */

/**
 * Bumped when a *reader* would misinterpret the previous shape.
 *
 * Adding an optional field that old Swift ignores does not need a bump; renaming
 * or re-meaning one does. The reader refuses anything it does not recognise
 * rather than guessing — see `readWidgetSnapshotFile`.
 */
export const WIDGET_SNAPSHOT_VERSION = 1;

/** The app's URL scheme, from `app.json`. Deep links are built from it here so
 *  the extension only ever copies a string it was handed. */
export const DEEP_LINK_SCHEME = 'chromawave';

/**
 * How many memories the file carries.
 *
 * A large widget shows at most six, and the shared container is read
 * synchronously on the extension's main thread during a timeline request. This
 * is a rendering budget, not a library.
 */
export const WIDGET_SNAPSHOT_CAPACITY = 8;

/** Bands a widget draws. Beyond five they are thinner than a hairline at small size. */
export const WIDGET_SNAPSHOT_BANDS = 5;

/* --------------------------------------------------------------- deep links */

export const deepLinkTargets = ['memory', 'pair', 'today', 'library'] as const;
export type DeepLinkTarget = (typeof deepLinkTargets)[number];

export type DeepLink =
  | { target: 'memory'; memoryId: string }
  | { target: 'pair'; memoryId: string }
  | { target: 'today' }
  | { target: 'library' };

/**
 * A link into the app, as a string both Swift and `expo-router` accept.
 *
 * Built rather than written, because the two places that need one — a widget's
 * `widgetURL` and a Live Activity's tap target — are in a language that cannot
 * import this module, and a hand-typed `chromawave://memroy/…` fails silently.
 */
export function toDeepLink(link: DeepLink): string {
  switch (link.target) {
    case 'memory':
      return `${DEEP_LINK_SCHEME}://memory/${encodeURIComponent(link.memoryId)}`;
    case 'pair':
      return `${DEEP_LINK_SCHEME}://pair/${encodeURIComponent(link.memoryId)}`;
    case 'today':
      return `${DEEP_LINK_SCHEME}://today`;
    case 'library':
      return `${DEEP_LINK_SCHEME}://library`;
  }
}

/**
 * The inverse, and deliberately strict.
 *
 * A deep link is untrusted input: it arrives from the OS, and on iOS anything
 * that can open a URL can send one. An unrecognised host, a wrong scheme or a
 * missing id returns null and the app stays where it is, which is the same
 * allowlist posture `useNotificationRoute` already takes with payload routes.
 */
export function parseDeepLink(url: string): DeepLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${DEEP_LINK_SCHEME}:`) return null;

  // `chromawave://memory/abc` parses with host 'memory' and pathname '/abc'.
  const host = parsed.hostname;
  const id = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).trim();

  switch (host) {
    case 'memory':
      return id ? { target: 'memory', memoryId: id } : null;
    case 'pair':
      return id ? { target: 'pair', memoryId: id } : null;
    // A trailing segment on a target that takes no id is a malformed link, not
    // a link with something extra — accepting it would make two different URLs
    // mean the same thing and a typo indistinguishable from intent.
    case 'today':
      return id ? null : { target: 'today' };
    case 'library':
      return id ? null : { target: 'library' };
    default:
      return null;
  }
}

/* ----------------------------------------------------------------- snapshot */

export const widgetBandSchema = z.object({
  hex: hexSchema,
  /** 0–1, already normalised. Swift lays these out with no arithmetic. */
  weight: z.number().min(0).max(1),
});

export type WidgetBand = z.infer<typeof widgetBandSchema>;

export const widgetMemorySnapshotSchema = z.object({
  id: z.string().uuid(),

  /**
   * Group-container-relative, never absolute.
   *
   * The extension resolves it against its own
   * `containerURL(forSecurityApplicationGroupIdentifier:)`, because the app's
   * absolute paths contain a data-container UUID that iOS is free to change
   * between launches — an absolute path baked into a snapshot is a broken image
   * one OS update later. Null for a colour-only memory, which renders as bands.
   */
  imagePath: z.string().min(1).max(200).nullable(),

  /**
   * Also group-relative, and null until the app has cached the artwork itself.
   *
   * The track's remote `artworkUrl` is deliberately *not* carried. Rule 2: a
   * widget must not reach the network to draw, and the provider's terms do not
   * contemplate an extension hot-linking their CDN on a timeline refresh.
   */
  artworkPath: z.string().min(1).max(200).nullable(),

  bands: z.array(widgetBandSchema).min(1).max(WIDGET_SNAPSHOT_BANDS),

  /** The band a solid fill should use. Precomputed so Swift never picks. */
  dominantHex: hexSchema,
  /** Black or white, already contrast-checked against `dominantHex`. Rule 1. */
  inkHex: hexSchema,

  /** From `AtmosphereReading.mood`. A short lowercase word; Swift capitalises. */
  mood: z.string().min(1).max(24),

  /** Null when the memory is unpaired. Both are null together, never one. */
  trackTitle: z.string().min(1).max(80).nullable(),
  trackArtist: z.string().min(1).max(80).nullable(),

  /** ISO 8601. Formatted on the device, in the device's locale, by Swift. */
  capturedAt: z.iso.datetime(),

  /** Where a tap goes. Always populated — a widget with no destination is a poster. */
  deepLink: z.string().min(1).max(300),
});

export type WidgetMemorySnapshot = z.infer<typeof widgetMemorySnapshotSchema>;

export const widgetSnapshotFileSchema = z.object({
  schemaVersion: z.literal(WIDGET_SNAPSHOT_VERSION),
  /** When the app last wrote this. The extension shows staleness from it. */
  updatedAt: z.iso.datetime(),
  /** So a widget can match the app the user actually looks at. */
  skin: z.enum(['chroma', 'swiss']),
  entries: z.array(widgetMemorySnapshotSchema).max(WIDGET_SNAPSHOT_CAPACITY),
});

export type WidgetSnapshotFile = z.infer<typeof widgetSnapshotFileSchema>;

/**
 * The empty file, which is a real state and not an error.
 *
 * A fresh install has a widget on the home screen before it has a memory in the
 * library. That widget renders the empty case, and it does so from this rather
 * than from a nil the extension has to branch on in four places.
 */
export const emptyWidgetSnapshotFile = (
  skin: WidgetSnapshotFile['skin'] = 'chroma',
  now: string = new Date().toISOString(),
): WidgetSnapshotFile => ({
  schemaVersion: WIDGET_SNAPSHOT_VERSION,
  updatedAt: now,
  skin,
  entries: [],
});

/* --------------------------------------------------------------- projection */

/**
 * One memory, reduced to what a lock screen may show.
 *
 * **What is dropped, and why it is dropped here rather than filtered later.**
 * `personalContext` — the note, the title, the mood the user typed, the tags,
 * the place name — never enters this function's output. Not because a widget
 * would look cluttered, but because a widget is visible to anyone who picks up
 * the phone, and the note is the one field in `ChromaticMemory` that contains
 * whatever the user felt like writing. A `redacted` flag would be the wrong
 * mechanism: it can be forgotten, inverted, or read after the data has already
 * been written to a container that other processes can open. Absence cannot.
 *
 * `visualAnalysis`, `facets`, `collectionIds` and the recommendation list are
 * dropped for size: none of them is drawable at 155pt.
 */
export function toWidgetSnapshot(memory: ChromaticMemory): WidgetMemorySnapshot {
  const bands = [...memory.palette.colors]
    // Widest first, so a truncated set keeps the colours the photograph was
    // actually made of rather than the first five the extractor happened to emit.
    .sort((first, second) => second.weight - first.weight)
    .slice(0, WIDGET_SNAPSHOT_BANDS);

  // Re-normalised after truncation. Swift lays bands out proportionally and a
  // set summing to 0.82 would leave a gap that looks like a rendering bug.
  const total = bands.reduce((sum, color) => sum + color.weight, 0) || 1;

  const dominantHex =
    memory.palette.colors.find((color) => color.role === 'dominant')?.hex ??
    bands[0]?.hex ??
    '#000000';

  const track = memory.musicPairing.selectedTrack;

  return {
    id: memory.id,
    // A colour-only memory has no frame to show; `isColorOnly` is the same
    // predicate the library uses, so the two never disagree about what a
    // palette-only record looks like.
    imagePath: isColorOnly(memory.image) ? null : imagePathFor(memory.id),
    // Populated by the snapshot writer once artwork has been cached into the
    // group container. Null here is correct and common: most memories are read
    // before their artwork has ever been fetched.
    artworkPath: null,
    bands: bands.map((color) => ({
      hex: color.hex,
      weight: Math.round((color.weight / total) * 1000) / 1000,
    })),
    dominantHex,
    inkHex: safeForegroundFor(dominantHex),
    mood: memory.atmosphere.mood,
    // Both or neither. The schema allows each to be null independently; this is
    // the only writer, and it keeps them in step so Swift can test one field.
    trackTitle: track ? truncate(track.title, 80) : null,
    trackArtist: track ? truncate(track.artist, 80) : null,
    capturedAt: memory.capturedAt,
    deepLink: toDeepLink({ target: 'memory', memoryId: memory.id }),
  };
}

/**
 * The group-relative path the app writes a widget's copy of a frame to.
 *
 * A *copy*, resized for the largest widget family, not the original: the
 * original is a multi-megabyte camera frame in the app's documents directory,
 * which an extension cannot read and should not be asked to decode on a
 * timeline request.
 */
export const imagePathFor = (memoryId: string): string => `widget/${memoryId}.jpg`;
export const artworkPathFor = (memoryId: string): string => `widget/${memoryId}-artwork.jpg`;

/**
 * The file the app writes, from the memories it has.
 *
 * Ordering is the product decision here: most recently captured first, because
 * the small widget shows `entries[0]` and "the last thing I saw" is the only
 * ordering a person can predict without opening the app.
 */
export function buildWidgetSnapshotFile(
  memories: readonly ChromaticMemory[],
  options: { skin: WidgetSnapshotFile['skin']; now?: string },
): WidgetSnapshotFile {
  const entries = [...memories]
    .sort((first, second) => second.capturedAt.localeCompare(first.capturedAt))
    .slice(0, WIDGET_SNAPSHOT_CAPACITY)
    .map(toWidgetSnapshot);

  return {
    schemaVersion: WIDGET_SNAPSHOT_VERSION,
    updatedAt: options.now ?? new Date().toISOString(),
    skin: options.skin,
    entries,
  };
}

/* ------------------------------------------------------------------ reading */

export type SnapshotReadResult =
  | { status: 'ok'; file: WidgetSnapshotFile; dropped: number }
  | { status: 'empty' }
  /** A version this build does not understand. Refused, never guessed at. */
  | { status: 'unsupported'; found: number }
  | { status: 'corrupt'; reason: string };

/**
 * Parses a snapshot file defensively, the way the extension has to.
 *
 * Exists in TypeScript as well as Swift because it is the behaviour worth
 * testing: the Swift side is thirty lines of `JSONDecoder` and the interesting
 * cases — a half-written file, a future version, one bad entry among seven — are
 * all decided by this logic. `snapshot.test.ts` exercises them here so the Swift
 * port has a specification rather than an intention.
 *
 * A single unreadable entry is dropped and the rest are kept, which is the same
 * per-record posture `StoredMemoryRepository` takes: losing one memory from a
 * widget is a blemish, losing all eight is a bug report.
 */
export function readWidgetSnapshotFile(raw: unknown): SnapshotReadResult {
  if (raw === null || raw === undefined || raw === '') return { status: 'empty' };

  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      // A truncated write. The app writes atomically, so this means the file was
      // damaged outside our control — recoverable by the next write.
      return { status: 'corrupt', reason: 'not-json' };
    }
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { status: 'corrupt', reason: 'not-an-object' };
  }

  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { status: 'corrupt', reason: 'no-version' };
  }
  // Older *and* newer are both refused. An extension is updated with the app, so
  // a mismatch means a downgrade or a partially-installed update, and rendering
  // a best-effort guess at an unknown shape is how wrong data reaches a lock
  // screen. Refusing shows the empty state, which is honest.
  if (version !== WIDGET_SNAPSHOT_VERSION) return { status: 'unsupported', found: version };

  const envelope = z
    .object({
      schemaVersion: z.literal(WIDGET_SNAPSHOT_VERSION),
      updatedAt: z.iso.datetime(),
      skin: z.enum(['chroma', 'swiss']),
      entries: z.array(z.unknown()),
    })
    .safeParse(value);

  if (!envelope.success) {
    return { status: 'corrupt', reason: 'envelope-invalid' };
  }

  const entries: WidgetMemorySnapshot[] = [];
  let dropped = 0;
  for (const candidate of envelope.data.entries.slice(0, WIDGET_SNAPSHOT_CAPACITY)) {
    const parsed = widgetMemorySnapshotSchema.safeParse(candidate);
    if (parsed.success) entries.push(parsed.data);
    else dropped++;
  }

  return {
    status: 'ok',
    file: { ...envelope.data, entries },
    dropped,
  };
}

/**
 * Whether the app should ask WidgetKit to reload.
 *
 * WidgetKit budgets timeline reloads per day and silently starts ignoring an app
 * that asks too often — so "reload after every write" is not a safe default, it
 * is how a widget stops updating for everyone. Content-compared rather than
 * timestamp-compared, because `updatedAt` changes on every write by definition
 * and would make this function always return true.
 */
export function snapshotChanged(
  previous: WidgetSnapshotFile | null,
  next: WidgetSnapshotFile,
): boolean {
  if (previous === null) return true;
  if (previous.skin !== next.skin) return true;
  if (previous.entries.length !== next.entries.length) return true;
  return previous.entries.some((entry, index) => !sameEntry(entry, next.entries[index]));
}

const sameEntry = (first: WidgetMemorySnapshot, second: WidgetMemorySnapshot | undefined) =>
  second !== undefined &&
  first.id === second.id &&
  first.imagePath === second.imagePath &&
  first.artworkPath === second.artworkPath &&
  first.dominantHex === second.dominantHex &&
  first.mood === second.mood &&
  first.trackTitle === second.trackTitle &&
  first.trackArtist === second.trackArtist &&
  first.bands.length === second.bands.length &&
  first.bands.every(
    (band, index) =>
      band.hex === second.bands[index]?.hex && band.weight === second.bands[index]?.weight,
  );

/** Cuts on a word boundary where there is one nearby, so a title ends in a word. */
function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}
