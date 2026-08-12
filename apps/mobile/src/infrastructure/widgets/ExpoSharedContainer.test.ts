import { ExpoSharedContainer, ExpoTimelineReloader } from './ExpoSharedContainer';

/**
 * The absence cases, which are the ones that decide whether the app runs at all
 * on a platform without the extension.
 */

type Native = ConstructorParameters<typeof ExpoSharedContainer>[0];

const nativeStub = (overrides: Partial<NonNullable<Native>> = {}): NonNullable<Native> => ({
  containerPath: () => '/private/var/mobile/Containers/Shared/AppGroup/ABC',
  read: () => null,
  write: () => true,
  copyIn: () => true,
  prune: () => 0,
  reloadWidgets: () => undefined,
  ...overrides,
});

describe('ExpoSharedContainer', () => {
  it('is unavailable when the native module is absent', () => {
    // Android, Expo Go, and Jest all land here.
    expect(new ExpoSharedContainer(null).available).toBe(false);
  });

  it('is unavailable when the entitlement was never provisioned', () => {
    const container = new ExpoSharedContainer(nativeStub({ containerPath: () => null }));
    expect(container.available).toBe(false);
  });

  it('is available when the module resolves a container', () => {
    expect(new ExpoSharedContainer(nativeStub()).available).toBe(true);
  });

  it('resolves availability once rather than on every call', () => {
    let calls = 0;
    const container = new ExpoSharedContainer(
      nativeStub({
        containerPath: () => {
          calls += 1;
          return '/shared';
        },
      }),
    );
    container.write('a.json', '{}');
    container.write('b.json', '{}');
    expect(calls).toBe(1);
  });

  it('degrades to a no-op rather than throwing without a module', () => {
    const container = new ExpoSharedContainer(null);
    expect(() => container.write('a.json', '{}')).not.toThrow();
    expect(() => container.prune([])).not.toThrow();
    expect(container.copyIn('file:///a.jpg', 'widget/a.jpg')).toBe(false);
    expect(container.read('a.json')).toBeNull();
  });

  it('passes a mutable copy to prune, which crosses a native boundary', () => {
    let received: string[] | null = null;
    const container = new ExpoSharedContainer(
      nativeStub({
        prune: (keep) => {
          received = keep;
          return 0;
        },
      }),
    );
    container.prune(['widget/a.jpg']);
    expect(received).toEqual(['widget/a.jpg']);
    expect(Array.isArray(received)).toBe(true);
  });
});

describe('ExpoTimelineReloader', () => {
  it('does nothing without a module', () => {
    expect(() => new ExpoTimelineReloader(null).reload()).not.toThrow();
  });

  it('asks WidgetKit to reload when one is present', () => {
    let reloads = 0;
    new ExpoTimelineReloader(nativeStub({ reloadWidgets: () => void (reloads += 1) })).reload();
    expect(reloads).toBe(1);
  });
});
