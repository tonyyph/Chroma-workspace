import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
// Alternate app icons are a native capability with no JS fallback; the mock reports
// the simulator-style "unsupported" state so tests exercise the graceful path.
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
  // Null is the ordinary case: the app was opened from the icon, not a
  // notification. `useNotificationRoute` tests supply their own response.
  useLastNotificationResponse: jest.fn(() => null),
}));

// The photo library is a native capability with no JS fallback. The mock grants
// permission and swallows the write, so the success path runs under test; tests
// that care about refusal override `requestPermissionsAsync` themselves.
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  saveToLibraryAsync: jest.fn(async () => undefined),
}));

const { setUpTests } =
  jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated');

setUpTests();

// MMKV is a Nitro module with no JS fallback under Jest; the repositories are
// tested against an in-memory KeyValueStorage, so the mock only has to exist.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, string>();
    return {
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => store.set(key, value),
      remove: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
      getAllKeys: () => [...store.keys()],
    };
  },
}));

// Skia has no JS renderer under Jest. Canvases become plain views so screens that
// draw bands or gradients still mount and can be asserted on.
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const passthrough = (name: string) => {
    const C = ({ children }: { children?: unknown }) => React.createElement(name, null, children);
    C.displayName = name;
    return C;
  };
  return {
    Canvas: passthrough('SkiaCanvas'),
    Group: passthrough('SkiaGroup'),
    Paint: passthrough('SkiaPaint'),
    Blur: passthrough('SkiaBlur'),
    Path: passthrough('SkiaPath'),
    Rect: passthrough('SkiaRect'),
    Fill: passthrough('SkiaFill'),
    Shader: passthrough('SkiaShader'),
    ImageShader: passthrough('SkiaImageShader'),
    Image: passthrough('SkiaImage'),
    LinearGradient: passthrough('SkiaLinearGradient'),
    RadialGradient: passthrough('SkiaRadialGradient'),
    SweepGradient: passthrough('SkiaSweepGradient'),
    vec: (x: number, y: number) => ({ x, y }),
    useImage: () => null,
    TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
    FontWeight: { Normal: 400, Medium: 500 },
    FontWidth: { Normal: 5 },
    FontSlant: { Upright: 0 },
    Skia: {
      Path: {
        MakeFromSVGString: () => ({}),
        // The ambient backdrop builds its bands with `Make`, so a mock without
        // it takes down the whole root layout rather than just the canvas.
        Make: () => ({ moveTo() {}, lineTo() {}, close() {} }),
      },
      RuntimeEffect: { Make: () => ({}) },
      Data: { fromURI: jest.fn(async () => ({})) },
      Image: { MakeImageFromEncoded: () => null },
      // The offscreen renderer behind PNG export. It returns a surface whose
      // snapshot encodes to empty bytes: enough for the caller's success path to
      // run under test, without pretending to rasterise anything.
      Surface: {
        MakeOffscreen: () => ({
          getCanvas: () => ({ drawRect: jest.fn(), drawColor: jest.fn(), drawText: jest.fn() }),
          flush: jest.fn(),
          makeImageSnapshot: () => ({ encodeToBytes: () => new Uint8Array() }),
        }),
      },
      Paint: () => ({ setColor: jest.fn(), setShader: jest.fn() }),
      Color: (value: string) => value,
      Point: (x: number, y: number) => ({ x, y }),
      XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
      Font: () => ({}),
      FontMgr: { System: () => ({ matchFamilyStyle: () => ({}) }) },
      Shader: {
        MakeLinearGradient: () => ({}),
        MakeRadialGradient: () => ({}),
        MakeSweepGradient: () => ({}),
      },
    },
  };
});

// Vision Camera is Nitro-backed; its hooks throw without the native module.
jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  return {
    Camera: ({ children }: { children?: unknown }) =>
      React.createElement('VisionCamera', null, children),
    useCameraDevice: () => ({ id: 'mock-back', position: 'back' }),
    useCameraPermission: () => ({
      hasPermission: true,
      canRequestPermission: true,
      requestPermission: jest.fn(async () => true),
      status: 'authorized',
    }),
    // The options are recorded, not ignored: which container format a screen
    // asks for decides whether the frame can be decoded at all, and that is
    // asserted in `photoContainerFormat.test.tsx`.
    usePhotoOutput: jest.fn(() => ({
      capturePhotoToFile: jest.fn(async () => ({ filePath: '/tmp/mock.jpg' })),
    })),
  };
});

// The full player surface, not only the two methods the sound cues used: the
// preview player pauses and releases, and a mock missing those turns a real
// teardown into a TypeError that only shows up as a failing test elsewhere.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    seekTo: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    currentTime: 0,
    duration: 0,
  }),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('expo-blur', () => {
  const React = require('react');
  return {
    BlurView: ({ children }: { children?: unknown }) =>
      React.createElement('BlurView', null, children),
  };
});

// expo-crypto is native; without this `randomUUID()` returns undefined and every
// schema that requires an id rejects — which is how a save silently failed.
jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

// expo-file-system's `File` is native. Export writes go through it, so without a
// stand-in every export path throws rather than exercising its own error branch.
jest.mock('expo-file-system', () => ({
  Paths: { cache: '/cache', document: '/documents' },
  File: class {
    uri: string;
    constructor(directory: { toString?: () => string } | string, name: string) {
      this.uri = `file://${String(directory)}/${name}`;
    }
    create() {}
    write() {}
    delete() {}
    get exists() {
      return false;
    }
  },
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `chromawave://${path.replace(/^\//, '')}`,
  openURL: jest.fn(async () => true),
}));
