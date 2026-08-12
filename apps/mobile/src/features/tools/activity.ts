import type { Palette } from '@cw/domain';

/**
 * G9's unread model, such as it can be without a server.
 *
 * There is no collaboration feed in a local-first build, so the only events that
 * exist are the user's own captures. An event is unread if it happened after the
 * feed was last cleared; clearing stamps `activityReadAt` at now, which is what
 * makes "MARK ALL READ" a real write rather than a label.
 *
 * A null marker means the feed has never been opened, so everything is unread.
 */
export function unreadActivity(
  palettes: readonly Palette[],
  readAt: string | null,
): readonly Palette[] {
  if (!readAt) return palettes;
  const since = Date.parse(readAt);
  // An unparseable marker is treated as no marker rather than as epoch zero,
  // which would silently mark the whole library read.
  if (Number.isNaN(since)) return palettes;
  return palettes.filter((palette) => Date.parse(palette.createdAt) > since);
}

export function unreadActivityCount(palettes: readonly Palette[], readAt: string | null): number {
  return unreadActivity(palettes, readAt).length;
}
