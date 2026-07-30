import {
  Canvas,
  Group,
  Image as SkiaImage,
  LinearGradient,
  RadialGradient,
  Rect,
  Shader,
  Skia,
  SweepGradient,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

/** ASSET SYSTEM · G — "grain-128.png · tile · 4%". */
const GRAIN = require('../../assets/brand/textures/grain-128.png');

export type GradientKind = 'linear' | 'radial' | 'conic' | 'mesh';
export type Interpolation = 'oklab' | 'srgb' | 'hsl';

/**
 * G5 · GRADIENT STUDIO, all four modes on the GPU.
 *
 * Conic is Skia's `SweepGradient`; mesh is a small SkSL shader that blends four
 * corner colours bilinearly, which is what a four-point mesh gradient is. Both
 * were shown disabled before Skia was a dependency.
 */
export function GradientCanvas({
  width,
  height,
  colors,
  kind,
  angle,
  interpolation,
  grain = false,
}: {
  width: number;
  height: number;
  colors: readonly string[];
  kind: GradientKind;
  /** Degrees, clockwise from the +x axis. */
  angle: number;
  interpolation: Interpolation;
  grain?: boolean;
}) {
  // Interpolating in OKLab means blending perceptually rather than in raw sRGB,
  // which is what stops a violet→coral ramp passing through mud. Skia
  // interpolates its own stops in sRGB, so extra midpoints are inserted, computed
  // in the requested space. That is an approximation of a true OKLab ramp, but
  // with enough stops it is visually indistinguishable and needs no shader.
  const stops = useMemo(() => expand(colors, interpolation), [colors, interpolation]);

  const radians = (angle * Math.PI) / 180;
  const centre = vec(width / 2, height / 2);
  const grainImage = useImage(grain ? GRAIN : null);
  const start = vec(
    width / 2 - (Math.cos(radians) * width) / 2,
    height / 2 - (Math.sin(radians) * height) / 2,
  );
  const end = vec(
    width / 2 + (Math.cos(radians) * width) / 2,
    height / 2 + (Math.sin(radians) * height) / 2,
  );

  const mesh = useMemo(() => (kind === 'mesh' ? Skia.RuntimeEffect.Make(MESH_SKSL) : null), [kind]);
  const meshUniforms = useMemo(() => {
    if (kind !== 'mesh') return null;
    const [a, b, c, d] = pick4(stops);
    return {
      size: [width, height],
      c0: rgbTriplet(a),
      c1: rgbTriplet(b),
      c2: rgbTriplet(c),
      c3: rgbTriplet(d),
    };
  }, [kind, stops, width, height]);

  return (
    <Canvas style={{ width, height }}>
      <Rect height={height} width={width} x={0} y={0}>
        {kind === 'linear' ? <LinearGradient colors={stops} end={end} start={start} /> : null}
        {kind === 'radial' ? (
          <RadialGradient c={centre} colors={stops} r={Math.hypot(width, height) / 2} />
        ) : null}
        {kind === 'conic' ? (
          // A sweep must return to its first colour or the seam is visible.
          <SweepGradient c={centre} colors={[...stops, stops[0] ?? '#000000']} start={angle} />
        ) : null}
        {kind === 'mesh' && mesh && meshUniforms ? (
          <Shader source={mesh} uniforms={meshUniforms} />
        ) : null}
      </Rect>
      {grain && grainImage ? (
        // The real 128px tile at 4%, repeated — a flat wash would just lift the
        // whole gradient rather than add texture.
        <Group opacity={0.04}>
          <SkiaImage fit="none" height={height} image={grainImage} width={width} x={0} y={0} />
        </Group>
      ) : null}
    </Canvas>
  );
}

/**
 * Bilinear blend of four corner colours. Written in SkSL so the whole mesh is
 * one GPU pass; the alternative is a grid of overlapping gradients.
 */
const MESH_SKSL = `
uniform float2 size;
uniform float3 c0;
uniform float3 c1;
uniform float3 c2;
uniform float3 c3;

half4 main(float2 xy) {
  float2 uv = xy / size;
  float3 top = mix(c0, c1, uv.x);
  float3 bottom = mix(c2, c3, uv.x);
  return half4(half3(mix(top, bottom, uv.y)), 1.0);
}
`;

/** Four corners from however many colours the palette supplied. */
function pick4(colors: readonly string[]): [string, string, string, string] {
  const a = colors[0] ?? '#7C5CFF';
  const b = colors[Math.floor(colors.length / 3)] ?? a;
  const c = colors[Math.floor((colors.length * 2) / 3)] ?? b;
  const d = colors[colors.length - 1] ?? c;
  return [a, b, c, d];
}

function rgbTriplet(hex: string): number[] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/**
 * Inserts midpoints between each adjacent pair, computed in the requested space.
 * Three inserted stops per gap is enough that the remaining sRGB interpolation
 * between them is imperceptible.
 */
function expand(colors: readonly string[], interpolation: Interpolation): string[] {
  const source = colors.length >= 2 ? colors : ['#7C5CFF', '#22D3EE'];
  if (interpolation === 'srgb') return [...source];

  const out: string[] = [];
  for (let i = 0; i < source.length - 1; i++) {
    const from = source[i]!;
    const to = source[i + 1]!;
    out.push(from);
    for (const t of [0.25, 0.5, 0.75]) {
      out.push(interpolation === 'oklab' ? mixOklab(from, to, t) : mixHsl(from, to, t));
    }
  }
  out.push(source[source.length - 1]!);
  return out;
}

/* ------------------------------------------------------------ colour mixing */

const srgbToLinear = (v: number) => {
  const n = v / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
};

function toOklab(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = srgbToLinear((value >> 16) & 255);
  const g = srgbToLinear((value >> 8) & 255);
  const b = srgbToLinear(value & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${channels
    .map((c) => Math.round(linearToSrgb(c)).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function mixOklab(from: string, to: string, t: number): string {
  const a = toOklab(from);
  const b = toOklab(to);
  return fromOklab([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

function mixHsl(from: string, to: string, t: number): string {
  const [h1, s1, l1] = toHsl(from);
  const [h2, s2, l2] = toHsl(to);
  // Take the shorter way round the wheel, else a 350°→10° blend crosses green.
  let delta = h2 - h1;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return fromHsl((((h1 + delta * t) % 360) + 360) % 360, s1 + (s2 - s1) * t, l1 + (l2 - l1) * t);
}

function toHsl(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const l = (max + min) / 2;
  return [(h + 360) % 360, d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
}

function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector] ?? [0, 0, 0];
  return `#${rgb
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, (channel + m) * 255)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}
