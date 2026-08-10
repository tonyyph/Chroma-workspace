# 09 · Persistence and migration plan

## The hazard this plan exists to avoid

`StoredPaletteRepository.list()` today:

```ts
return paletteListSchema.parse(JSON.parse(raw)); // throws on ANY bad record
```

On failure it raises `DomainError('PERSISTED_DATA_INVALID')`. Not "skip the bad
one" — **the whole library becomes unreadable**. Combined with
`schemaVersion: z.literal(1)`, which rejects a v2 record outright, a careless
migration destroys every saved palette on the user's device at once.

Two rules follow, and everything else in this document is a consequence:

1. **Never parse the collection as a unit.** Parse per record, keep what is
   valid, quarantine what is not.
2. **Never write a shape the previous build cannot read** until the previous
   build can no longer be running.

## Storage layout

| Key                           | v1 (today)     | v2 (target)                        |
| ----------------------------- | -------------- | ---------------------------------- |
| `@chromawave/palettes:v1`     | `Palette[]`    | **retained, read-only, untouched** |
| `@chromawave/memories:v2`     | —              | `ChromaticMemory[]`                |
| `@chromawave/migration:state` | —              | `{ version, migratedAt, counts }`  |
| sets key                      | `PaletteSet[]` | unchanged                          |
| preferences key               | v1             | widened, defaults added            |

**The v1 key is not deleted, not rewritten, and not moved.** It is the rollback.
Disk cost is a few hundred KB of JSON for a large library — trivially worth an
undo button on the riskiest operation the app will ever perform on user data.

## Migration

Runs once, on launch, from `infrastructure/dependencies.ts` next to the existing
`migrateStorage()` — there is already precedent for a launch-time migration
(`MmkvStorage.migrateFromAsyncStorage`).

```ts
export async function migratePalettesToMemories(storage: KeyValueStorage): Promise<MigrationReport>;
```

```
1. Read migration state. If version >= 2, return early. Idempotent.
2. Read the raw v1 array. Absent or empty → mark v2, done (new install).
3. For each element:
     a. paletteSchema.safeParse
     b. valid   → paletteToMemory(palette)      → migrated[]
        invalid → { index, issues, raw }        → quarantined[]
4. Validate every produced memory with chromaticMemorySchema.safeParse.
   Any failure here is OUR bug, not the user's data: abort the whole
   migration, leave v1 untouched, record the failure. The app runs on the
   v1-backed projection and the user loses nothing.
5. Write memories:v2 in one operation.
6. Write migration state { version: 2, migratedAt, migrated: n, quarantined: m }.
7. Leave palettes:v1 in place.
```

Step 4 is the safety interlock: a migration that cannot produce valid output does
not produce _any_ output.

## Field mapping

Total. Nothing in a v1 palette is discarded.

| v1 `Palette` | v2 `ChromaticMemory`                                     |
| ------------ | -------------------------------------------------------- |
| `id`         | `id` — **preserved**, so `palette/[id]` deep links work  |
| `createdAt`  | `createdAt`, `updatedAt`                                 |
| `capturedAt` | `capturedAt`                                             |
| `name`       | `personalContext.title`                                  |
| `source`     | `palette.source`                                         |
| `colors`     | `palette.colors` — byte-identical, same `colorSchema`    |
| `deltaE`     | `palette.deltaE`                                         |
| `confidence` | `palette.confidence`                                     |
| `space`      | `palette.space`                                          |
| `tuned`      | `palette.tuned`                                          |
| `tags`       | `personalContext.tags`                                   |
| `location`   | `personalContext.location`                               |
| `photoUri`   | `image.localUri`; `null` → `PALETTE_ONLY_IMAGE` sentinel |
| `setIds`     | `collectionIds`                                          |
| `isPinned`   | `isPinned`                                               |
| —            | `atmosphere` = `readAtmosphere(colors)` — **computed**   |
| —            | `visualAnalysis` = `null`                                |
| —            | `musicPairing` = `{ status: 'unpaired', … }`             |
| —            | `facets` = `deriveFacets(...)` — computed                |

Two derived fields (`atmosphere`, `facets`) come from pure functions over data we
already have, so migration needs no network and cannot partially fail.

### Palettes with no photograph

`photoUri` is nullable in v1 and `image.localUri` is required in v2 — a memory is
built around a moment. Rather than weaken the schema for every future record, a
v1 palette without a photo migrates with `image.source: 'legacy'` and a sentinel
uri, and renders as a **colour-only memory**: the palette bands fill the hero
where the photograph would be. Legacy items are first-class in Memories, are
filterable, and can be paired with music like any other.

## Quarantine, not deletion

A v1 record that fails `safeParse` — corrupted write, hand-edited storage, a bug
we shipped — is written verbatim to `@chromawave/quarantine:v1` with its
validation issues, and surfaced in **You → Storage** as "N saved palettes could
not be read". Never silently dropped, never silently deleted. Recovery tooling
can come later; losing the data cannot be undone later.

## Rollback

`@chromawave/memories:v2` is derived and disposable; `palettes:v1` is the source
of truth until the deprecation window closes. Rolling back is deleting the v2 key
and the migration state. Available as a hidden dev action, and as the recovery
path if a post-release defect is found.

The v1 key is removed only after: two releases have shipped with v2, telemetry
would show a failure (there is none, so: after a deliberate review), and a
release note says so. Realistically it stays for a year. It is cheap.

## Writes after migration

`ChromaticMemoryRepository` becomes the only writer of memory data.

`PaletteRepository` and `SetRepository` **keep their interfaces** and are
reimplemented as projections:

```ts
class MemoryBackedPaletteRepository implements PaletteRepository {
  list()  → memories.map(memoryToPalette)
  save(p) → read memory, patch palette + facets, write memory
}
```

This is what keeps the ten `tools/*` screens, `mergePalettes`, `paletteGaps`,
`discovery.ts`, `libraryStore` and their tests compiling and passing without
modification. The professional colour surface is genuinely untouched by the
restoration.

`memoryToPalette` and `paletteToMemory` are round-trip tested:
`paletteToMemory → memoryToPalette` is the identity on every v1 field.

## Forward compatibility

- `schemaVersion: z.literal(2)`. A v3 will add `z.union([v2, v3])` with an
  upgrade function, and this document will grow a section rather than be replaced.
- Every field added after v2 ships must carry `.default()` or `.nullable()` — the
  existing `preferences.ts` already establishes this convention (`colorSpace`,
  `soundEnabled`, `ambientBackdrop` were added exactly this way, with comments
  explaining why).
- Reads use `safeParse` per record, always. `parse` on a collection is banned;
  a lint-level test asserts it does not reappear.

## Tests required before this ships

| Test                                          | Asserts                           |
| --------------------------------------------- | --------------------------------- |
| Migrates a realistic v1 library of 50         | count, ids, colours preserved     |
| Round-trips every v1 field                    | no data loss                      |
| Palette with `photoUri: null`                 | legacy colour-only memory         |
| One corrupt record among valid ones           | 49 migrate, 1 quarantined         |
| All records corrupt                           | abort, v1 intact, no v2 written   |
| Runs twice                                    | idempotent, no duplicates         |
| Interrupted before state write                | re-runs cleanly next launch       |
| Empty / absent v1 key                         | clean new install                 |
| `memoryToPalette` over migrated data          | tools keep working                |
| Reading a memory list with one invalid record | rest still load; problem reported |
| Serialised memory contains no audio URL       | preview URLs never persisted      |
