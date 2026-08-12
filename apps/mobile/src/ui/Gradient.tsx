import type { GradientRole } from '@cw/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ViewStyle } from 'react-native';

/**
 * A gradient the skin chose, filling whatever it is placed in.
 *
 * Exists so a screen writes the *role* — "put a medium scrim at the foot of
 * this" — and never the stops. `LinearGradient` wants `colors` and `locations`
 * as separate props, so without this every call site would spread a role by
 * hand and be one keystroke away from passing chroma's stops with swiss's
 * locations.
 *
 * Vertical by default, because every role in the contract runs down the surface.
 * `horizontal` is for the two that run across.
 */
export function Gradient({
  role,
  horizontal = false,
  pointerEvents = 'none',
  style,
}: {
  role: GradientRole;
  horizontal?: boolean;
  pointerEvents?: 'none' | 'auto' | 'box-none';
  style?: ViewStyle;
}) {
  return (
    <LinearGradient
      colors={[...role.colors] as [string, string, ...string[]]}
      end={horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 }}
      pointerEvents={pointerEvents}
      start={{ x: 0, y: 0 }}
      style={style ?? StyleSheet.absoluteFill}
      {...(role.locations
        ? { locations: [...role.locations] as [number, number, ...number[]] }
        : {})}
    />
  );
}
