import {
  buildWidgetSnapshotFile,
  imagePathFor,
  readWidgetSnapshotFile,
  snapshotChanged,
  type ChromaticMemory,
  type WidgetSnapshotFile,
} from '@cw/domain';
import type { KeyValueStorage } from '@/infrastructure/KeyValueStorage';

/**
 * Publishes the library to the shared container the widget reads.
 *
 * **Why this is not simply `writeFile` at the end of a save.** Three things have
 * to be true at once and only one of them is writing a file:
 *
 *  1. The images the snapshot points at must exist *before* the file that names
 *     them does, or the first timeline render after a save draws a hole.
 *  2. WidgetKit must be asked to reload — but not every time. It budgets reloads
 *     per day and silently starts ignoring an app that overspends them, so the
 *     ask is gated on the content actually differing. See `snapshotChanged`.
 *  3. None of it may fail loudly. A save must not be undone because a widget
 *     could not be updated; the memory is the product, the widget is a view of
 *     it. Every path here returns a result and none of them throws.
 *
 * Written against injected seams rather than against `expo-file-system` and
 * `WidgetCenter` directly, because the interesting behaviour — when it copies,
 * when it reloads, what it does when the container is missing — is exactly the
 * behaviour that is impossible to test through a native module.
 */

/** The App Group container, as the two operations this needs from it. */
export interface SharedContainer {
  /**
   * Whether the container can be reached at all.
   *
   * False on Android, on a simulator without the entitlement, and on a device
   * whose provisioning profile lacks the App Group. All three are ordinary and
   * none is an error: the app works, the widget shows its empty state.
   */
  readonly available: boolean;
  read(relativePath: string): string | null;
  write(relativePath: string, contents: string): void;
  /** Copies a local file in. Returns false when the source is gone. */
  copyIn(sourceUri: string, relativePath: string): boolean;
  /** Removes files under `widget/` that no snapshot entry refers to any more. */
  prune(keep: readonly string[]): void;
}

export interface TimelineReloader {
  reload(): void;
}

export type SnapshotSyncResult =
  | { status: 'written'; entries: number; images: number; reloaded: boolean }
  /** The content matched what is already published. The valuable case. */
  | { status: 'unchanged' }
  /** No container — Android, or an entitlement that was never provisioned. */
  | { status: 'unavailable' }
  | { status: 'failed'; reason: string };

/** Where the last published file is remembered, so a cold start can compare. */
export const LAST_PUBLISHED_KEY = '@chromawave/widget:published:v1';

export const SNAPSHOT_FILE_NAME = 'widget-snapshot.json';

export class WidgetSnapshotWriter {
  constructor(
    private readonly container: SharedContainer,
    private readonly reloader: TimelineReloader,
    private readonly storage: KeyValueStorage,
  ) {}

  async sync(
    memories: readonly ChromaticMemory[],
    skin: WidgetSnapshotFile['skin'],
    now: string = new Date().toISOString(),
  ): Promise<SnapshotSyncResult> {
    if (!this.container.available) return { status: 'unavailable' };

    try {
      const file = buildWidgetSnapshotFile(memories, { skin, now });

      /**
       * Images first, and the snapshot corrected to match what actually landed.
       *
       * `toWidgetSnapshot` names the path a frame *would* have; only this loop
       * knows whether the copy succeeded. Publishing a path to a file that was
       * never written is how a widget ends up rendering a grey rectangle where
       * the photograph should be — so a failed copy nulls the field and the
       * widget falls back to the palette bands, which is a designed state.
       */
      const byId = new Map(memories.map((memory) => [memory.id, memory]));
      let images = 0;

      const entries = file.entries.map((entry) => {
        if (entry.imagePath === null) return entry;
        const memory = byId.get(entry.id);
        const source = memory?.image.thumbnailUri ?? memory?.image.localUri ?? null;
        // The thumbnail is preferred over the original deliberately: the
        // original is a multi-megabyte camera frame, and an extension that
        // decodes one during a timeline request is an extension iOS kills for
        // exceeding its memory limit.
        if (source === null) return { ...entry, imagePath: null };

        const copied = this.container.copyIn(source, imagePathFor(entry.id));
        if (copied) images += 1;
        return copied ? entry : { ...entry, imagePath: null };
      });

      const next: WidgetSnapshotFile = { ...file, entries };
      const previous = this.lastPublished(await this.storage.getItem(LAST_PUBLISHED_KEY));

      if (!snapshotChanged(previous, next)) return { status: 'unchanged' };

      this.container.write(SNAPSHOT_FILE_NAME, JSON.stringify(next));
      // Only what the published file still refers to. A memory deleted from the
      // library must not leave its photograph readable in a shared container.
      this.container.prune(
        entries.flatMap((entry) => (entry.imagePath === null ? [] : [entry.imagePath])),
      );
      await this.storage.setItem(LAST_PUBLISHED_KEY, JSON.stringify(next));

      this.reloader.reload();
      return { status: 'written', entries: entries.length, images, reloaded: true };
    } catch (error) {
      // Never rethrown. This runs on the tail of a save, and a save that appears
      // to fail because a widget could not be updated is the worse bug.
      return { status: 'failed', reason: error instanceof Error ? error.message : 'unknown' };
    }
  }

  /**
   * Everything this app put in the shared container, removed.
   *
   * The delete-my-data path has to reach here too: a container the user cannot
   * see from inside the app is exactly the kind of leftover that makes "delete
   * everything" untrue.
   */
  async clear(): Promise<void> {
    if (!this.container.available) return;
    try {
      this.container.write(SNAPSHOT_FILE_NAME, '');
      this.container.prune([]);
      await this.storage.removeItem(LAST_PUBLISHED_KEY);
      this.reloader.reload();
    } catch {
      // Best effort. The records themselves are already gone by this point.
    }
  }

  /**
   * The last file we published, or null.
   *
   * Parsed through the same reader the extension uses rather than trusted,
   * because a shape this build cannot read is exactly the case where a reload
   * *should* happen — `snapshotChanged(null, next)` is true.
   */
  private lastPublished(raw: string | null): WidgetSnapshotFile | null {
    const result = readWidgetSnapshotFile(raw);
    return result.status === 'ok' ? result.file : null;
  }
}

/**
 * The writer used when there is no shared container — Android, Expo Go, and any
 * build whose entitlement was never provisioned.
 *
 * A real object rather than an `if` at every call site: the sync happens on the
 * save path, and a null check there is one someone will eventually forget.
 */
export const unavailableContainer: SharedContainer = {
  available: false,
  read: () => null,
  write: () => undefined,
  copyIn: () => false,
  prune: () => undefined,
};

export const noopReloader: TimelineReloader = { reload: () => undefined };
