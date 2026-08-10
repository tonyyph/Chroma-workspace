import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Screens must not know which music service they are talking to.
 *
 * The provider decision has already had to be reversed once: Spotify removed
 * 30-second preview access for applications registered after 2024-11-27, which
 * retired the adapter most designs would have been built around. The next such
 * change should be one file, and it only stays one file if provider-shaped
 * fields never reach a screen.
 *
 * Deliberately a source scan rather than a type check. TypeScript already stops
 * a screen holding an `ITunesResult`; what it cannot stop is a screen reading
 * `track.previewUrl` off an `any`, hardcoding an `itunes.apple.com` URL, or
 * branching on a provider name — all of which typecheck and all of which are the
 * failure this guards.
 */

const ROOT = join(__dirname, '..');

/** Where product code lives. Adapters are exempt — mapping is their job. */
const PRODUCT_DIRS = ['features', 'app', 'store', 'hooks', 'components'];

/** The adapter layer, which is allowed and required to know these things. */
const ADAPTER_DIR = join(ROOT, 'infrastructure', 'music');

/**
 * Field names that belong to a provider payload, not to the domain.
 *
 * `previewUrl` is the important one: it is both a provider field and a value the
 * domain deliberately refuses to persist, so a screen mentioning it is either
 * reading a raw payload or storing something it must not.
 */
const PROVIDER_FIELDS = [
  'previewUrl',
  'trackId',
  'collectionName',
  'wrapperType',
  'artworkUrl100',
  'trackViewUrl',
  'primaryGenreName',
  'trackTimeMillis',
];

/** Provider hosts and scheme prefixes, in the forms they get written in. */
const PROVIDER_ENDPOINTS =
  /itunes\.apple\.com|api\.spotify\.com|api\.deezer\.com|spotify:track:|music\.apple\.com\/[a-z]{2}\//i;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(full) && !full.includes('.test.')) out.push(full);
  }
  return out;
}

const files = PRODUCT_DIRS.flatMap((dir) => sources(join(ROOT, dir)));

describe('product code does not know which music provider is behind it', () => {
  it('scans a meaningful number of files, so a broken glob cannot pass silently', () => {
    expect(files.length).toBeGreaterThan(25);
  });

  it('reads no provider payload field', () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const found = PROVIDER_FIELDS.filter((field) => new RegExp(`\\b${field}\\b`).test(source));
      return found.length ? [`${file.replace(ROOT, '')}: ${found.join(', ')}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it('writes no provider endpoint', () => {
    const offenders = files.filter((file) => PROVIDER_ENDPOINTS.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => file.replace(ROOT, ''))).toEqual([]);
  });

  it('keeps the adapter layer, which is where provider knowledge belongs', () => {
    // If this fails the exemption above has drifted from where adapters live,
    // and the scan may be exempting nothing at all.
    const adapters = sources(ADAPTER_DIR);
    expect(adapters.length).toBeGreaterThan(0);
    expect(adapters.some((file) => PROVIDER_ENDPOINTS.test(readFileSync(file, 'utf8')))).toBe(true);
  });
});

describe('persisted data carries no audio URL', () => {
  /**
   * A preview URL is temporary, provider-controlled, and points at copyrighted
   * audio. `MusicTrackReference` has no field for one by design; this asserts
   * nothing reintroduces one through a cast or a spread.
   */
  it('the domain track model declares no preview field', () => {
    const model = readFileSync(
      join(ROOT, '..', '..', '..', 'packages', 'domain', 'src', 'music.ts'),
      'utf8',
    );
    const reference = model.slice(
      model.indexOf('musicTrackReferenceSchema'),
      model.indexOf('export type MusicTrackReference'),
    );
    expect(reference).not.toMatch(/previewUrl|preview:/);
  });
});
