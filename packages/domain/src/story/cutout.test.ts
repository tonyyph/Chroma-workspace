import { describe, expect, it } from 'vitest';

import {
  CUTOUT_CONFIDENCE_FLOOR,
  CutoutUnavailableError,
  cutoutMaskSchema,
  isConfident,
  UnavailableSubjectExtractor,
  type CutoutMask,
} from './cutout';
import { storyElementSchema } from './elements';

const mask = (overrides: Partial<CutoutMask> = {}): CutoutMask =>
  cutoutMaskSchema.parse({
    maskUri: 'file:///story-assets/s1/mask.png',
    width: 4032,
    height: 3024,
    confidence: 0.9,
    extractorVersion: 'vision-1',
    extractedAt: '2026-08-18T09:00:00.000Z',
    ...overrides,
  });

describe('the shipped extractor is honestly absent', () => {
  it('reports itself unavailable rather than returning nothing', async () => {
    const extractor = new UnavailableSubjectExtractor();
    const availability = await extractor.availability();

    expect(availability.status).toBe('unavailable');
    if (availability.status === 'unavailable') {
      expect(availability.reason).toBe('not-implemented');
    }
  });

  it('refuses to extract rather than inventing a mask', async () => {
    // A rectangular "mask" would teach people the feature works badly rather
    // than that it is not here yet. There is deliberately no fallback shape.
    await expect(new UnavailableSubjectExtractor().extract()).rejects.toBeInstanceOf(
      CutoutUnavailableError,
    );
  });

  it('names the reason on the error, so a log says what to fix', async () => {
    await expect(new UnavailableSubjectExtractor().extract()).rejects.toMatchObject({
      reason: 'not-implemented',
    });
  });
});

describe('the mask model', () => {
  it('accepts a well-formed mask', () => {
    expect(cutoutMaskSchema.safeParse(mask()).success).toBe(true);
  });

  it('carries a file reference, never pixels', () => {
    // The same rule `project.ts` applies to images: a mask for a 4096px frame is
    // megabytes, and no document or store is a place for that.
    expect(Object.keys(mask())).not.toContain('base64');
    expect(Object.keys(mask())).not.toContain('bytes');
  });

  it('refuses a confidence outside 0-1', () => {
    expect(cutoutMaskSchema.safeParse({ ...mask(), confidence: 1.2 }).success).toBe(false);
  });

  it('refuses a mask with no dimensions', () => {
    expect(cutoutMaskSchema.safeParse({ ...mask(), width: 0 }).success).toBe(false);
  });

  it('records which implementation produced it', () => {
    expect(mask().extractorVersion).toBe('vision-1');
  });
});

describe('confidence', () => {
  it('flags a weak mask rather than compositing it silently', () => {
    expect(isConfident(mask({ confidence: CUTOUT_CONFIDENCE_FLOOR - 0.01 }))).toBe(false);
    expect(isConfident(mask({ confidence: CUTOUT_CONFIDENCE_FLOOR }))).toBe(true);
  });
});

describe('the mask field on a photo', () => {
  const photo = (overrides: Record<string, unknown> = {}) => ({
    kind: 'photo',
    id: 'p',
    frame: { x: 0, y: 0, width: 100, height: 100 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: 'a',
    sourceWidth: 4032,
    sourceHeight: 3024,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    ...overrides,
  });

  it('defaults to unmasked, so every existing project still parses', () => {
    const parsed = storyElementSchema.parse(photo());
    expect(parsed.kind).toBe('photo');
    if (parsed.kind === 'photo') expect(parsed.maskAssetId).toBeNull();
  });

  it('accepts a mask asset id once something can produce one', () => {
    const parsed = storyElementSchema.parse(photo({ maskAssetId: 'mask-1' }));
    if (parsed.kind === 'photo') expect(parsed.maskAssetId).toBe('mask-1');
  });
});
