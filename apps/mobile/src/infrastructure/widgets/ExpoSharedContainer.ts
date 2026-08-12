import { requireOptionalNativeModule } from 'expo';
import type { SharedContainer, TimelineReloader } from './WidgetSnapshotWriter';

/**
 * The real App Group container, over the local module in
 * `modules/chromawave-shared-container`.
 *
 * `requireOptionalNativeModule` rather than `requireNativeModule` is the whole
 * design of this file: the module is iOS-only and is absent on Android, in Expo
 * Go, and under Jest. The optional form returns null there instead of throwing
 * at import time, which is what lets `available` be an honest boolean rather
 * than a try/catch around every call.
 */

type NativeSharedContainer = {
  containerPath(): string | null;
  read(relativePath: string): string | null;
  write(relativePath: string, contents: string): boolean;
  copyIn(sourceUri: string, relativePath: string): boolean;
  prune(keep: string[]): number;
  reloadWidgets(): void;
};

const native = requireOptionalNativeModule<NativeSharedContainer>('ChromawaveSharedContainer');

/**
 * Resolved once, at construction.
 *
 * The entitlement cannot appear part-way through a session — it is granted by
 * the provisioning profile the app launched with — so asking the OS on every
 * write would be a syscall per save for an answer that cannot change.
 */
export class ExpoSharedContainer implements SharedContainer {
  readonly available: boolean;

  constructor(private readonly module: NativeSharedContainer | null = native) {
    // Both conditions matter and they fail differently: no module means a
    // platform without the extension, while a null path means the module is
    // there but the App Group entitlement was never provisioned — the ordinary
    // state on a simulator build with no team.
    this.available = module !== null && module.containerPath() !== null;
  }

  read(relativePath: string): string | null {
    return this.module?.read(relativePath) ?? null;
  }

  write(relativePath: string, contents: string): void {
    this.module?.write(relativePath, contents);
  }

  copyIn(sourceUri: string, relativePath: string): boolean {
    return this.module?.copyIn(sourceUri, relativePath) ?? false;
  }

  prune(keep: readonly string[]): void {
    this.module?.prune([...keep]);
  }
}

/** WidgetKit's reload, which lives in the same module because it is the same
 *  entitlement and the same "iOS only, may be absent" story. */
export class ExpoTimelineReloader implements TimelineReloader {
  constructor(private readonly module: NativeSharedContainer | null = native) {}

  reload(): void {
    this.module?.reloadWidgets();
  }
}
