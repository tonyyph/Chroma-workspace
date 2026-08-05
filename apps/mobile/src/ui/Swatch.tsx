import { size, space } from '@chromawave/design-tokens';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Pressable } from './Pressable';

import { Text } from './Text';

export type SwatchEntry = {
  hex: string;
  /** Share of the image, 0-1. Drives the proportional widths. */
  weight: number;
  role?: string | null;
};

/**
 * A proportional band strip — the recurring "photo + band strip + metadata"
 * middle zone. Widths are the colour weights, so the strip reads as the actual
 * composition of the capture rather than an even split.
 *
 * ACCESSIBILITY (SYSTEM F): "Every colour row exposes its hex as the
 * accessibility label, never just the swatch."
 */
export function SwatchStrip({
  colors,
  height = size.bandStripMin,
  radius = 0,
  style,
}: {
  colors: readonly SwatchEntry[];
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      accessibilityLabel={colors.map((c) => c.hex).join(', ')}
      accessibilityRole="image"
      style={[
        styles.strip,
        // "band strips keep 10px minimum height" at Dynamic Type XXL.
        { height: Math.max(height, size.bandStripMin), borderRadius: radius },
        style,
      ]}
    >
      {colors.map((color) => (
        <View key={color.hex} style={{ flex: color.weight, backgroundColor: color.hex }} />
      ))}
    </View>
  );
}

/**
 * A colour row: swatch, role name, hex and share, and a trailing action.
 * The B2 result sheet and the B4 hex list are both this row at two densities.
 */
export function ColorRow({
  color,
  onCopy,
  dense = false,
}: {
  color: SwatchEntry;
  onCopy?: (hex: string) => void;
  dense?: boolean;
}) {
  const rgb = hexToRgb(color.hex);
  const label = color.role ? `${color.role}, ${color.hex}` : color.hex;

  return (
    <View accessibilityLabel={label} style={styles.row}>
      <View
        style={[styles.rowSwatch, dense && styles.rowSwatchDense, { backgroundColor: color.hex }]}
      />
      {dense ? (
        <>
          <Text style={styles.rowHex} variant="mono">
            {color.hex.toUpperCase()}
          </Text>
          <Text tone="tertiary" variant="mono">
            {rgb}
          </Text>
        </>
      ) : (
        <View style={styles.rowCopy}>
          {color.role ? <Text variant="cardTitle">{color.role}</Text> : null}
          <Text tone="secondary" variant="monoSmall">
            {`${color.hex.toUpperCase()} · ${Math.round(color.weight * 100)}%`}
          </Text>
        </View>
      )}
      {onCopy ? (
        <Pressable
          accessibilityHint={`Copies ${color.hex}`}
          accessibilityLabel={`Copy ${color.hex}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onCopy(color.hex)}
          style={styles.copy}
        >
          <Text tone="tertiary" variant="chip">
            COPY
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const int = Number.parseInt(value, 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rowSwatch: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  rowSwatchDense: {
    width: 30,
    height: 30,
    borderRadius: 9,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowHex: {
    flex: 1,
  },
  copy: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(237,234,227,.16)',
    borderRadius: 9,
  },
});
