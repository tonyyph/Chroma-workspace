import { getAppIconName, setAlternateAppIcon } from 'expo-alternate-app-icons';

import { ExpoAppIconService } from './ExpoAppIconService';

const mockGetAppIconName = jest.mocked(getAppIconName);
const mockSetAlternateAppIcon = jest.mocked(setAlternateAppIcon);

/**
 * The global jest setup reports `supportsAlternateIcons: false`, which is the
 * simulator/web state. Each test declares the capability it needs.
 */
function serviceWithSupport(supported: boolean): ExpoAppIconService {
  const service = new ExpoAppIconService();
  Object.defineProperty(service, 'supported', { value: supported });
  return service;
}

describe('ExpoAppIconService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppIconName.mockReturnValue(null);
  });

  it('clears the alternate icon for Bandwave, the build default', async () => {
    mockGetAppIconName.mockReturnValue('LiquidLens');

    await serviceWithSupport(true).apply('bandwave');

    expect(mockSetAlternateAppIcon).toHaveBeenCalledWith(null);
  });

  it('sets the CFBundleAlternateIcons entry for Liquid Lens', async () => {
    await serviceWithSupport(true).apply('liquid-lens');

    expect(mockSetAlternateAppIcon).toHaveBeenCalledWith('LiquidLens');
  });

  it('skips the call when the icon already matches, so iOS shows no alert', async () => {
    mockGetAppIconName.mockReturnValue('LiquidLens');

    await serviceWithSupport(true).apply('liquid-lens');

    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });

  it('is a no-op where the platform has no alternate icon support', async () => {
    await serviceWithSupport(false).apply('liquid-lens');

    expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
  });
});
