# Database design

Cycle one has no remote database. Device storage contains schema-versioned JSON and
private copied image files. The repository validates records on read and fails with
a typed corruption error instead of passing malformed state to UI.

## Planned PostgreSQL ownership

Future migrations will introduce `profiles`, `memories`, `memory_assets`,
`palettes`, `palette_colors`, `music_pairings`, `collections`, and
`collection_items`. Every user-owned table will have RLS enabled. Private media
paths remain internal and clients receive short-lived signed URLs.

Indexes will begin with `(owner_id, captured_at desc)` for timeline queries and a
partial public index for discovery. Public projection data will be separate from
private notes and original asset metadata. No SQL migration is created before a
real Supabase environment exists because an unverified speculative schema would
be misleading.
