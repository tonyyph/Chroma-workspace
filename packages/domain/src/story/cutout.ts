import { z } from 'zod';

/**
 * Subject extraction, behind an interface, because the implementation is a
 * platform capability rather than a property of this product.
 *
 * **Decision D4** (`docs/creative-platform/00-repository-audit.md` §15): iOS
 * Vision's `VNGenerateForegroundInstanceMaskRequest`. It is the only route that
 * is on-device, free, high quality, needs no model in the bundle, and — the part
 * that decided it — never sends a private photograph anywhere. A backend would
 * mean uploading people's pictures to compute something the phone can already do,
 * which contradicts the local-first posture the app states in `.env.example`.
 *
 * **The consequence is a platform capability, not a broken button.** Vision is
 * iOS-only. Android has no implementation, so on Android the extractor reports
 * itself unavailable and the feature is **absent from the UI** rather than
 * present and failing. `MusicProvider` already establishes this shape:
 * `UnconfiguredMusicProvider` is a reachable, honest "cannot" rather than a
 * silent nothing.
 *
 * **Nothing here fakes a mask.** The brief is explicit and so is this module:
 * there is no code path that invents an extraction and presents it as one. An
 * unavailable extractor says so, and the caller shows a limitation.
 */

/**
 * What an extractor can do here and now.
 *
 * Checked before anything is offered, so the decision "show this feature at all"
 * is made from a real answer rather than from a platform string in a component.
 */
export const cutoutAvailabilityReasons = [
  /** This build has no implementation for this platform. */
  'not-implemented',
  /** The OS is older than the API needs. */
  'os-too-old',
  /** The device reported the capability missing at runtime. */
  'device-unsupported',
] as const;
export type CutoutUnavailableReason = (typeof cutoutAvailabilityReasons)[number];

export type CutoutAvailability =
  | { readonly status: 'available' }
  | { readonly status: 'unavailable'; readonly reason: CutoutUnavailableReason };

/**
 * The result of an extraction that ran.
 *
 * `maskUri` is a file, not bytes: a mask for a 4096px photograph is megabytes,
 * and putting that in a document — or in application state — is the base64
 * mistake the brief forbids and `project.ts` already refuses for images.
 */
export const cutoutMaskSchema = z.object({
  /** A single-channel or alpha image on disk, the same dimensions as the source. */
  maskUri: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /**
   * How sure the extractor is, 0–1.
   *
   * Surfaced rather than hidden. A weak mask is worth showing with a warning so
   * the author can judge it; presenting a 0.3 extraction with the same
   * confidence as a 0.95 one is the fabrication this interface exists to avoid.
   */
  confidence: z.number().min(0).max(1),
  /** Which implementation produced it, so a stored mask can be re-run knowingly. */
  extractorVersion: z.string().min(1).max(32),
  extractedAt: z.iso.datetime(),
});

export type CutoutMask = z.infer<typeof cutoutMaskSchema>;

export type CutoutRequest = {
  /** The source image on disk. The extractor reads it; it never leaves the device. */
  readonly sourceUri: string;
  /** Where the mask should be written. The caller owns asset lifetimes. */
  readonly destinationUri: string;
};

export type CutoutOutcome =
  | { readonly status: 'extracted'; readonly mask: CutoutMask }
  /** The image has no clear foreground subject. Not an error — a real answer. */
  | { readonly status: 'no-subject' }
  | { readonly status: 'failed'; readonly reason: string };

export interface SubjectExtractor {
  readonly id: string;
  availability(): Promise<CutoutAvailability>;
  extract(request: CutoutRequest): Promise<CutoutOutcome>;
}

/**
 * Thrown when something calls `extract` on an extractor that said it could not.
 *
 * A programming error rather than a user-facing condition: callers are expected
 * to consult `availability()` and not offer the feature at all. Named so that if
 * it ever appears in a log, the fix is obvious.
 */
export class CutoutUnavailableError extends Error {
  constructor(readonly reason: CutoutUnavailableReason) {
    super(`Subject extraction is unavailable: ${reason}`);
    this.name = 'CutoutUnavailableError';
  }
}

/**
 * The shipped default until the Vision module lands.
 *
 * Deliberately not a stub that returns a rectangle. A rectangular "mask" is not
 * a cutout, and shipping one would teach people the feature works badly rather
 * than that it is not here yet. `NullImageUnderstandingProvider` sets the
 * precedent: the honest implementation of an absent capability is one that says
 * it is absent.
 */
export class UnavailableSubjectExtractor implements SubjectExtractor {
  readonly id = 'none';

  availability(): Promise<CutoutAvailability> {
    return Promise.resolve({ status: 'unavailable', reason: 'not-implemented' });
  }

  extract(): Promise<CutoutOutcome> {
    return Promise.reject(new CutoutUnavailableError('not-implemented'));
  }
}

/**
 * Whether a mask is worth applying without warning the author.
 *
 * Below this the edges are usually wrong in ways that look like a bug rather
 * than like a rough cut, so the UI says so instead of quietly compositing it.
 */
export const CUTOUT_CONFIDENCE_FLOOR = 0.55;

export const isConfident = (mask: CutoutMask): boolean =>
  mask.confidence >= CUTOUT_CONFIDENCE_FLOOR;
