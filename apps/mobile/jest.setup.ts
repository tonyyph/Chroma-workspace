import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
// Alternate app icons are a native capability with no JS fallback; the mock reports
// the simulator-style "unsupported" state so tests exercise the graceful path.
jest.mock('expo-alternate-app-icons', () => ({
  supportsAlternateIcons: false,
  getAppIconName: jest.fn(() => null),
  setAlternateAppIcon: jest.fn(async () => null),
  resetAppIcon: jest.fn(async () => {}),
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  cancelScheduledNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'test-notification'),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

const { setUpTests } =
  jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated');

setUpTests();
