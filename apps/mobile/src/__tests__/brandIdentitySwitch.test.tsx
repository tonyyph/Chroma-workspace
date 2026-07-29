import { defaultUserPreferences, type UserPreferences } from '@chromawave/domain';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { appIconService, preferencesRepository } from '@/infrastructure/dependencies';
import { PreferencesProvider } from '@/providers/PreferencesProvider';

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => effect(),
}));

let mockStored: UserPreferences = defaultUserPreferences;

jest.mock('@/infrastructure/dependencies', () => ({
  analytics: { track: jest.fn() },
  appIconService: { supported: true, apply: jest.fn(async () => {}) },
  hapticsService: { selection: jest.fn(async () => {}), success: jest.fn(async () => {}) },
  notificationScheduler: {
    getPermission: jest.fn(async () => 'undetermined'),
    requestPermission: jest.fn(async () => 'granted'),
    scheduleDaily: jest.fn(async () => 'id'),
    cancel: jest.fn(async () => {}),
  },
  preferencesRepository: {
    get: jest.fn(async () => mockStored),
    save: jest.fn(async (next: UserPreferences) => {
      mockStored = next;
    }),
  },
}));

const mockApply = jest.mocked(appIconService.apply);
const mockSave = jest.mocked(preferencesRepository.save);

async function renderSettings() {
  render(
    <PreferencesProvider>
      <SettingsScreen />
    </PreferencesProvider>,
  );
  await screen.findByText('Liquid Lens');
}

describe('brand identity switch', () => {
  beforeEach(() => {
    mockStored = defaultUserPreferences;
    jest.clearAllMocks();
  });

  it('starts on Bandwave, the identity document’s recommended mark', async () => {
    await renderSettings();

    expect(screen.getByRole('radio', { name: 'Bandwave' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Liquid Lens' })).not.toBeSelected();
  });

  it('persists the choice and swaps the home screen icon', async () => {
    await renderSettings();

    fireEvent.press(screen.getByRole('radio', { name: 'Liquid Lens' }));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ brandIdentity: 'liquid-lens' }),
      );
      expect(mockApply).toHaveBeenCalledWith('liquid-lens');
    });
  });

  it('keeps the saved identity when the home screen icon swap is refused', async () => {
    mockApply.mockRejectedValueOnce(new Error('user dismissed the iOS alert'));
    await renderSettings();

    fireEvent.press(screen.getByRole('radio', { name: 'Liquid Lens' }));

    await waitFor(() => {
      expect(screen.getByText(/home screen icon was not changed/)).toBeOnTheScreen();
    });
    expect(mockStored.brandIdentity).toBe('liquid-lens');
    expect(screen.getByRole('radio', { name: 'Liquid Lens' })).toBeSelected();
  });
});
