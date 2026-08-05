import { size, ui } from '@chromawave/design-tokens';
import Feather from '@expo/vector-icons/Feather';
import type { StyleProp, TextStyle } from 'react-native';

/**
 * The icon vocabulary, named by what the control does rather than what it looks
 * like — so a screen asks for `back`, not `chevron-left`, and swapping the set
 * later is one map, not a search across every screen.
 *
 * Feather is the set: 24px grid, 2px round-capped strokes, no filled variants.
 * That is the same hairline weight SYSTEM F draws its borders and dividers at,
 * which is why the icons sit on the type rather than shouting over it.
 *
 * Before this, controls were typed characters — `⌕`, `✕`, `•••`, `‹`. Those
 * render in whatever the text font has, so they shifted weight and baseline
 * between iOS and Android, could not be sized against the control they sat in,
 * and were read aloud by VoiceOver as their Unicode names.
 */
const GLYPHS = {
  search: 'search',
  close: 'x',
  more: 'more-horizontal',
  back: 'chevron-left',
  forward: 'chevron-right',
  swap: 'repeat',
  add: 'plus',
  remove: 'x',
  arrowRight: 'arrow-right',
  library: 'grid',
  explore: 'compass',
  sets: 'layers',
  profile: 'user',
  /** The filter disclosure, and the chevron that closes what it opened. */
  filter: 'sliders',
  collapse: 'chevron-up',
  expand: 'chevron-down',
  trending: 'trending-up',
  capture: 'camera',
  pinned: 'bookmark',
  activity: 'bell',
  settings: 'settings',
  retry: 'refresh-cw',
  palette: 'droplet',
} as const satisfies Record<string, React.ComponentProps<typeof Feather>['name']>;

export type IconName = keyof typeof GLYPHS;

/** Which control the icon sits in, which is what decides its size. */
export type IconScale = 'inline' | 'control' | 'action' | 'navigation';

const SCALES: Record<IconScale, number> = {
  inline: size.iconInline,
  control: size.iconControl,
  action: size.iconAction,
  navigation: size.tabIcon,
};

export function Icon({
  name,
  scale = 'control',
  color = ui.text.primary,
  style,
}: {
  name: IconName;
  scale?: IconScale;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Feather
      accessibilityElementsHidden
      color={color}
      importantForAccessibility="no"
      name={GLYPHS[name]}
      size={SCALES[scale]}
      style={style}
    />
  );
}
