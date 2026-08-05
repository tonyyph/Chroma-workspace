import { makeColor, type Palette } from '@chromawave/domain';
import { fallbackPhotoIndexFor } from './PalettePhoto';

const palette = (id: string, hex: string): Palette => ({
  schemaVersion: 1,
  id,
  name: 'Fallback test',
  createdAt: '2026-08-03T00:00:00.000Z',
  capturedAt: '2026-08-03T00:00:00.000Z',
  source: 'scan',
  colors: [makeColor(hex, 0.6, 'dominant'), makeColor('#EDEAE3', 0.4, 'support')],
  tags: [],
  location: null,
  photoUri: null,
  deltaE: 2,
  confidence: 0.9,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
});

describe('fallbackPhotoIndexFor', () => {
  it('keeps each seeded palette paired with its authored photograph', () => {
    expect(fallbackPhotoIndexFor(palette('a0000000-0000-4000-8000-000000000001', '#7C5CFF'))).toBe(
      0,
    );
    expect(fallbackPhotoIndexFor(palette('a0000000-0000-4000-8000-000000000002', '#FFC24A'))).toBe(
      1,
    );
    expect(fallbackPhotoIndexFor(palette('a0000000-0000-4000-8000-000000000003', '#22D3EE'))).toBe(
      2,
    );
    expect(fallbackPhotoIndexFor(palette('a0000000-0000-4000-8000-000000000004', '#C4623B'))).toBe(
      3,
    );
  });

  it('chooses a colour-matched photograph for palettes without a source frame', () => {
    expect(fallbackPhotoIndexFor(palette('11111111-1111-4111-8111-111111111111', '#20C8D8'))).toBe(
      2,
    );
    expect(fallbackPhotoIndexFor(palette('22222222-2222-4222-8222-222222222222', '#D16A3B'))).toBe(
      3,
    );
  });
});
