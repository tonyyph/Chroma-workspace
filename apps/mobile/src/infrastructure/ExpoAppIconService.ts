import type { AppIconService, BrandIdentityId } from '@chromawave/domain';
import { brandIdentities } from '@chromawave/design-tokens';
import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from 'expo-alternate-app-icons';

/**
 * Maps a brand identity onto the `CFBundleAlternateIcons` entry declared by the
 * `expo-alternate-app-icons` config plugin in app.json.
 *
 * Bandwave is the build's default icon, so selecting it means clearing the alternate
 * rather than setting one — `alternateIconName` is `null` for that identity.
 */
export class ExpoAppIconService implements AppIconService {
  readonly supported = supportsAlternateIcons;

  async apply(identity: BrandIdentityId): Promise<void> {
    if (!this.supported) return;

    const target = brandIdentities[identity].alternateIconName;
    // iOS shows a system alert on every successful call, so skip the no-op case.
    if (getAppIconName() === target) return;

    await setAlternateAppIcon(target as Parameters<typeof setAlternateAppIcon>[0]);
  }
}
