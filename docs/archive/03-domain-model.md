# Domain model

## Memory aggregate

A `Memory` owns:

- identity, creation timestamp, private/public visibility, note, and favorite state;
- one local `MemoryAsset`;
- one ordered `Palette` with perceptual metrics and a classified mood;
- zero or one `MusicPairing`.

`PaletteColor` stores hex, normalized weight, and OKLCH values. UI code may render
hex values but does not classify mood or calculate safe contrast.

## Cycle-one invariants

- A Memory has exactly one persisted image asset.
- A palette has one to six meaningful colors and weights sum approximately to one.
- Visibility defaults to `private`.
- Notes are optional and limited to 500 characters.
- Provider models are mapped into `MusicTrack`; no Spotify type crosses the boundary.
- External and persisted input is parsed with Zod.

## Collection aggregate

A `Collection` owns a name, timestamps, and a unique ordered set of Memory IDs.
Collections do not duplicate a Memory or its asset. The repository persists the
aggregate locally with a versioned schema, and a missing Memory ID can be removed
without rewriting the Memory.

Monthly Recap and Palette Signature are deterministic projections over existing
Memories. They are deliberately not persisted: rebuilding them prevents derived
statistics from drifting when a Memory changes.

Native text-board sharing and music remixing operate on the existing Memory
aggregate. Sharing never includes the private image URI, and remixing replaces only
the typed `MusicPairing`.

Public memories, hosted export links, accounts, and subscriptions remain planned
aggregates outside the current local-first write path.
