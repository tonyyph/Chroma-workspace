import { brandBands } from '@cw/tokens';
import Svg, { Defs, FeGaussianBlur, Filter, Path, Rect } from 'react-native-svg';

/**
 * The decorative band field used for hero areas and previews.
 *
 * Ported from `Chroma Wave App.dc.html`'s `bands(w, hgt, k, opts)` — same
 * midlines (`hgt * (0.34 + i * 0.16)`), same amplitude (`hgt * 0.1`), same
 * 0.85 cycles, same 1.1rad phase step, same 0.85 opacity. Strokes overhang the
 * viewport by 20px at each end so the blur never reveals a cap.
 */
export function BandField({
  width,
  height,
  colors = brandBands,
  background,
  blur = 14,
  strokeWidth,
}: {
  width: number;
  height: number;
  colors?: readonly string[];
  background?: string;
  blur?: number;
  strokeWidth?: number;
}) {
  const stroke = strokeWidth ?? height * 0.19;

  return (
    <Svg
      height={height}
      preserveAspectRatio="xMidYMid slice"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <Defs>
        <Filter height="160%" id="bandBlur" width="160%" x="-30%" y="-30%">
          <FeGaussianBlur stdDeviation={blur} />
        </Filter>
      </Defs>
      {background ? <Rect fill={background} height={height} width={width} /> : null}
      {[0, 1, 2].map((i) => (
        <Path
          d={sine(height * (0.34 + i * 0.16), height * 0.1, 0.85, i * 1.1, -20, width + 20)}
          fill="none"
          filter="url(#bandBlur)"
          key={i}
          opacity={0.85}
          stroke={colors[i % colors.length] ?? brandBands[0]}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      ))}
    </Svg>
  );
}

/** Polyline sampling of `mid + amp · sin(2π · cyc · t + ph)`, 56 steps as published. */
export function sine(
  mid: number,
  amp: number,
  cyc: number,
  ph: number,
  x0: number,
  x1: number,
): string {
  let d = '';
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = mid + amp * Math.sin(2 * Math.PI * cyc * t + ph);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}

/** Superellipse of degree `n` — the mark silhouette, for empty-state glyphs. */
export function squircle(cx: number, cy: number, r: number, n: number): string {
  let d = '';
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x = cx + r * Math.sign(ca) * Math.abs(ca) ** (2 / n);
    const y = cy + r * Math.sign(sa) * Math.abs(sa) ** (2 / n);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
}
