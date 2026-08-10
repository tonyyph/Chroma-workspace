import { skins } from '@chromawave/design-tokens';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useFrameCallback,
  useReducedMotion,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { HARMONICS } from './backdropField';
import {
  backdropCycle,
  backdropResolution,
  backdropScroll,
  backdropShift,
  backdropTouchX,
  backdropTouchY,
  backdropUniforms,
} from './backdropMotion';
import { bandsAt, chromaFrom, chromaMix, chromaTo } from './chroma';

/**
 * How long one full cycle takes.
 *
 * The composition returns exactly to its start at the end of this, so the
 * number sets both the pace and the repeat period. Short enough that movement
 * is plainly visible within a couple of seconds; long enough that the return is
 * not something anyone sits and waits for.
 */
const CYCLE_MS = 26_000;

/** Builds the mass terms from the harmonics, so shader and test share a source. */
const massTerms = HARMONICS.map(
  (h, index) => `
  float2 c${index} = float2(
    ${h.cx.toFixed(3)} * aspect + sin((cycle * ${h.fx}.0 + ${h.px.toFixed(3)}) * TAU) * ${h.ax.toFixed(3)},
    ${h.cy.toFixed(3)} + cos((cycle * ${h.fy}.0 + ${h.py.toFixed(3)}) * TAU) * ${h.ay.toFixed(3)} - shift * ${h.drag.toFixed(2)}
  ) + pull * ${(0.4 + index * 0.3).toFixed(2)};
  float m${index} = massAt(uv, c${index}, ${h.radius.toFixed(3)});`,
).join('\n');

/**
 * The field behind every screen.
 *
 * **One pass, not a stack of blurred views.** Four soft colour masses drift on
 * looping paths and combine as metaballs — their fields add, so where two meet
 * they blend into a third colour rather than overlapping as discs.
 *
 * Built from blurred views this would be four full-screen blur passes per
 * frame. As SkSL it is a single fragment pass with no offscreen buffers.
 *
 * **The loop closes exactly.** Every frequency is a whole number, so at the end
 * of a cycle each mass is back at its starting position with its starting
 * velocity — see `backdropField` and its test for why that is not optional.
 */
const FIELD = `
uniform float2 resolution;
uniform float  cycle;     // 0-1, wraps
uniform float  scroll;    // damped scroll offset, in points
uniform float2 focus;     // where the light is drawn towards, 0-1
uniform float3 bandA;
uniform float3 bandB;
uniform float3 bandC;
uniform float3 ground;

const float TAU = 6.28318530718;

// Smooth falloff around a centre. Quadratic rather than gaussian: it reaches
// zero at a finite radius, so a mass stops contributing once it is far away and
// the field cannot wash out to a flat tint.
float massAt(float2 uv, float2 centre, float radius) {
  float d = length((uv - centre) / radius);
  float f = max(0.0, 1.0 - d * d);
  return f * f;
}

half4 main(float2 xy) {
  float2 uv = xy / resolution;
  // Correct for aspect so the masses stay round on a tall screen.
  float aspect = resolution.x / resolution.y;
  uv.x *= aspect;

  // Scroll moves the field less than the content above it; that difference is
  // the parallax. Normalised by height so it is screen-size neutral.
  float shift = scroll / resolution.y * 0.16;

  float2 pull = (focus - 0.5) * 0.12;
  pull.x *= aspect;

${massTerms}

  // Additive then normalised — this is what makes two masses meeting read as a
  // blend rather than one disc drawn over the other.
  float total = m0 + m1 + m2 + m3 + 0.0001;
  float3 colour = (bandA * m0 + bandB * m1 + bandC * m2 + bandA * m3) / total;

  // Pulled well back towards its own luminance. At full saturation the brand
  // colours behind a translucent card tint the content sitting on it, which is
  // the backdrop competing with the thing it is supposed to sit behind.
  float luma = dot(colour, float3(0.2126, 0.7152, 0.0722));
  colour = mix(float3(luma), colour, 0.55);

  // How much colour is present at all. Squared so the field stays mostly ground
  // and the colour reads as light pooling rather than a painted gradient.
  float presence = clamp(total * 0.38, 0.0, 1.0);
  presence *= presence;

  float3 rgb = mix(ground, colour, presence * 0.3);

  // A sheen on its own phase — whole-numbered too, so it loops with everything
  // else. Tight power and low amplitude: a hint of a moving light source, not a
  // highlight that draws the eye off the content.
  float sheen = sin((uv.x * 0.8 + uv.y * 1.4) * 2.2 - cycle * TAU) * 0.5 + 0.5;
  rgb += float3(0.020, 0.018, 0.030) * pow(sheen, 8.0);

  // Vignette, measured from the true centre rather than the aspect-corrected uv.
  float2 centred = xy / resolution - 0.5;
  float vignette = 1.0 - dot(centred, centred) * 0.8;
  rgb *= clamp(vignette, 0.0, 1.0);

  return half4(half3(rgb), 1.0);
}
`;

/** Hex to the 0-1 triplet the shader wants. */
function triplet(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/**
 * Bound to `chroma` explicitly, not to whichever skin is active.
 *
 * This component is the chroma skin — `swiss` sets `chrome.backdrop` false and
 * never mounts it, because a drifting metaball wash under a paper ground is not
 * a quieter version of the same idea. Reading the active skin here would
 * suggest it could render under either.
 *
 * It also could not, even if it should: the uniforms are assembled inside a
 * frame worklet, and a hook value cannot be read from one.
 */

/**
 * The ground, converted once at module load.
 *
 * The uniforms are built inside a worklet on the UI thread, and calling a plain
 * JS function from there throws — the ground never changes, so it is turned into
 * a plain array here and merely closed over. The three bands used to be
 * constants beside it; they now come from `chroma`, because the field wears
 * whatever palette is on screen.
 */
const GROUND = triplet(skins.chroma.ui.bg.base);

/**
 * Compiled once, at module load.
 *
 * Compiling SkSL is not free and it happens on the JS thread. Per screen — which
 * is where a `useMemo` inside the component puts it — that lands on the frame a
 * push starts, which is the one frame in the app that cannot afford it.
 */
const EFFECT = Skia.RuntimeEffect.Make(FIELD);

/**
 * Advances the field. Mounted once, at the root, and renders nothing.
 *
 * The clock is deliberately separated from the drawing: every screen paints its
 * own copy of the field so that it is opaque enough to cover the screen behind
 * it during a push, and copies that each ran their own clock would drift apart
 * and show the seam exactly when both are on screen at once.
 *
 * Two guards switch the motion off — the OS reduce-motion setting and the
 * user's own preference (which unmounts this entirely). The field still draws
 * when stopped, so the ground keeps its depth; it simply holds a frame.
 */
export function BackdropDriver() {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();

  /**
   * The whole per-frame cost of the backdrop, for every screen at once: chase
   * the scroll, then build the one uniforms object they all read.
   */
  const frame = useFrameCallback(() => {
    'worklet';
    // Chase rather than track: the lag is what separates the backdrop's plane
    // from the content's.
    backdropShift.value += (backdropScroll.value - backdropShift.value) * 0.06;
    // The bands are interpolated here rather than animated as nine separate
    // shared values: this worklet was already running and already building this
    // object, so adapting the field's colour costs one lerp a frame.
    const bands = bandsAt(chromaMix.value, chromaFrom.value, chromaTo.value);
    backdropUniforms.value = {
      resolution: backdropResolution.value,
      cycle: backdropCycle.value,
      scroll: backdropShift.value,
      focus: [backdropTouchX.value, backdropTouchY.value],
      bandA: bands[0] as [number, number, number],
      bandB: bands[1] as [number, number, number],
      bandC: bands[2] as [number, number, number],
      ground: GROUND,
    };
  }, false);

  useEffect(() => {
    backdropResolution.value = [width, height];
  }, [width, height]);

  useEffect(() => {
    if (reduced) {
      // Everything stops: parallax is motion too, and a frame callback left
      // running holds the UI thread awake for a field that is deliberately
      // standing still. The one frame it holds is written directly, since
      // nothing will rebuild the uniforms afterwards.
      frame.setActive(false);
      cancelAnimation(backdropCycle);
      backdropShift.value = 0;
      // Held where the masses are spread, so the still frame is a composition
      // rather than whatever the cycle happens to start on.
      backdropCycle.value = 0.22;
      const still = bandsAt(chromaMix.value, chromaFrom.value, chromaTo.value);
      backdropUniforms.value = {
        resolution: [width, height],
        cycle: 0.22,
        scroll: 0,
        focus: [0.5, 0.42],
        bandA: still[0] as [number, number, number],
        bandB: still[1] as [number, number, number],
        bandC: still[2] as [number, number, number],
        ground: GROUND,
      };
      return;
    }
    frame.setActive(true);
    // Linear and non-reversing. Easing would make the field accelerate and
    // brake once a lap; reversing would run the whole composition backwards.
    // Neither is wanted — the wrap is seamless, so plain repetition is smooth.
    backdropCycle.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      frame.setActive(false);
      cancelAnimation(backdropCycle);
    };
  }, [frame, reduced, width, height]);

  return null;
}

/**
 * The living field, drawn behind one screen.
 *
 * Every animated input is a uniform read from a shared value written by
 * `BackdropDriver`, so the field runs entirely on the UI thread: this component
 * renders once and then stays still while the GPU does the work. Nothing here
 * re-renders per frame, and two instances on screen during a transition are
 * frame-identical, so the push reads as content moving over one continuous
 * ground.
 */
export const UnderScreenCanvas = memo(function UnderScreenCanvas() {
  if (!EFFECT) return null;

  // `opaque`: the shader returns alpha 1 across the whole surface, so there is
  // nothing behind it to blend with. Saying so lets the compositor skip the
  // blend on a full-screen layer that every screen now carries.
  return (
    <Canvas opaque pointerEvents="none" style={[StyleSheet.absoluteFill, styles.canvas]}>
      <Fill>
        <Shader source={EFFECT} uniforms={backdropUniforms} />
      </Fill>
      {/* The real 128px tile. Grain over a smooth field is what stops a wide
          colour ramp banding on an OLED panel. */}
    </Canvas>
  );
});

const styles = StyleSheet.create({
  canvas: { backgroundColor: skins.chroma.ui.bg.base },
});
