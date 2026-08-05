import { brandBands, ui } from '@chromawave/design-tokens';
import Svg, { Path } from 'react-native-svg';
import { sine, squircle } from './BandField';

/**
 * FLOW E · "an empty state is the mark with something missing. Stroke-only,
 * never full colour." Ported from `emptyGlyph(i)` in the design document.
 */
export type EmptyGlyphKind = 'no-library' | 'no-results' | 'offline' | 'loading';

const order: Record<EmptyGlyphKind, 1 | 2 | 3 | 4> = {
  'no-library': 1,
  'no-results': 2,
  offline: 3,
  loading: 4,
};

export function EmptyGlyph({ kind, height = 130 }: { kind: EmptyGlyphKind; height?: number }) {
  const i = order[kind];
  const stroke = 'rgba(237,234,227,.5)';
  const body = squircle(200, 130, 92, 4);

  return (
    <Svg
      accessibilityElementsHidden
      height={height}
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 400 260"
      width="100%"
    >
      <Path
        d={body}
        fill="none"
        stroke={stroke}
        strokeWidth={8}
        {...(i === 3 ? { strokeDasharray: '44 24' } : {})}
      />
      {i === 1 ? (
        <Path
          d={sine(130, 0, 1, 0, 132, 268)}
          fill="none"
          stroke={stroke}
          strokeDasharray="4 18"
          strokeLinecap="round"
          strokeWidth={8}
        />
      ) : null}
      {i === 2 ? (
        <Path
          d={sine(130, 15, 0.85, 0, 130, 270)}
          fill="none"
          stroke={ui.action.primary}
          strokeLinecap="round"
          strokeWidth={12}
        />
      ) : null}
      {i === 3 ? (
        <Path d="M162 92 L238 168" stroke={stroke} strokeLinecap="round" strokeWidth={8} />
      ) : null}
      {i === 4
        ? [0, 1, 2].map((j) => (
            <Path
              d={sine(106 + j * 24, 12, 0.85, j * 1.1, 130, 270)}
              fill="none"
              key={j}
              opacity={0.92 - j * 0.22}
              stroke={brandBands[j] ?? brandBands[0]}
              strokeLinecap="round"
              strokeWidth={11}
            />
          ))
        : null}
    </Svg>
  );
}
