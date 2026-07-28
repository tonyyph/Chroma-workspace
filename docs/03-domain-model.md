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

Collections, public memories, exports, share links, accounts, and subscriptions are
planned aggregates but are outside the first write path.
