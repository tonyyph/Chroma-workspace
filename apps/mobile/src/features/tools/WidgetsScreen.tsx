import { round, space, ui } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Meta, NavBar, SwatchStrip, Text } from '@/ui';

/**
 * G8 · WIDGETS & LOCK SCREEN · "small/medium widgets, capture shortcut".
 *
 * A preview, not a live widget: WidgetKit extensions are native targets outside
 * the JS bundle, so this shows what will be built and how it composes against a
 * lock screen. Wallpaper is the brand gradient rather than a user photo.
 */
export function WidgetsScreen({ palette, onClose }: { palette: Palette; onClose?: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();
  const now = new Date();
  const time = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now
    .toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();

  return (
    <LinearGradient
      colors={['#2A2352', '#0C0B18']}
      end={{ x: 0.5, y: 0.66 }}
      start={{ x: 0.2, y: 0 }}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      {/* A full-bleed preview with no chrome had no way out but the OS gesture. */}
      {onClose ? (
        <View style={styles.nav}>
          <NavBar leading={t('widgets.close')} leadingIcon="back" onLeading={onClose} />
        </View>
      ) : null}

      <Text style={styles.clock}>{time}</Text>
      <Meta style={styles.date}>{date}</Meta>

      <View style={styles.smallRow}>
        <View style={styles.smallWidget}>
          <Meta style={styles.widgetLabel}>TODAY</Meta>
          <SwatchStrip colors={palette.colors.slice(0, 3)} height={28} radius={6} />
        </View>
        <View style={[styles.smallWidget, styles.smallWidgetCentred]}>
          <BrandMark size={62} />
        </View>
      </View>

      <View style={styles.mediumWidget}>
        <View style={styles.mediumHead}>
          <Meta style={styles.widgetLabel}>PALETTE OF THE DAY</Meta>
          <Meta style={styles.widgetLabel}>Chroma Wave</Meta>
        </View>
        <SwatchStrip colors={palette.colors} height={52} radius={12} />
        <Text style={styles.mediumTitle}>{palette.name}</Text>
      </View>

      <View style={styles.notification}>
        <BrandMark size={40} />
        <View style={styles.notificationCopy}>
          <Text style={styles.notificationTitle}>Golden hour in 20 min</Text>
          <Meta style={styles.widgetLabel}>BEST LIGHT FOR CAPTURE TODAY</Meta>
        </View>
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.dockButton} />
        <View style={styles.dockMark}>
          <BrandMark size={52} />
        </View>
      </View>
    </LinearGradient>
  );
}

const paper = '#F1E7D6';

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  nav: { alignSelf: 'stretch' },
  clock: {
    fontSize: 76,
    lineHeight: 80,
    letterSpacing: -3,
    color: paper,
    marginTop: space.lg,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  date: { color: 'rgba(241,231,214,.6)', marginTop: space.xs },
  smallRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  smallWidget: {
    width: 110,
    height: 110,
    borderRadius: 24,
    backgroundColor: 'rgba(237,234,227,.1)',
    borderWidth: 1,
    borderColor: 'rgba(237,234,227,.16)',
    padding: space.sm,
    justifyContent: 'space-between',
  },
  smallWidgetCentred: { alignItems: 'center', justifyContent: 'center' },
  widgetLabel: { color: 'rgba(241,231,214,.62)', fontSize: 8.5, letterSpacing: 1.2 },
  mediumWidget: {
    width: 340,
    marginTop: space.sectionGap,
    borderRadius: 26,
    backgroundColor: 'rgba(237,234,227,.1)',
    borderWidth: 1,
    borderColor: 'rgba(237,234,227,.16)',
    padding: space.md,
    gap: space.sm,
  },
  mediumHead: { flexDirection: 'row', justifyContent: 'space-between' },
  mediumTitle: { fontSize: 14, fontWeight: '600', color: paper },
  notification: {
    width: 340,
    marginTop: space.cardGap,
    borderRadius: round.card + 2,
    backgroundColor: 'rgba(12,11,24,.66)',
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    padding: space.cardGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  notificationCopy: { flex: 1, gap: 3 },
  notificationTitle: { fontSize: 13, fontWeight: '600', color: paper },
  dock: { marginTop: 'auto', flexDirection: 'row', gap: 70, alignItems: 'center' },
  dockButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(237,234,227,.12)',
    borderWidth: 1,
    borderColor: 'rgba(237,234,227,.18)',
  },
  dockMark: { borderRadius: 26, overflow: 'hidden' },
});
