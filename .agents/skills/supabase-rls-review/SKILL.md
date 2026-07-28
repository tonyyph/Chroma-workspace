---
name: supabase-rls-review
description: Review CHROMAWAVE Supabase schemas, migrations, storage and Row Level Security for privacy and tenant isolation. Use for every backend or database milestone.
---

Review all affected tables, functions, views, buckets and policies.

CHROMAWAVE stores personal photos, palettes, personal notes, music preferences and
optional locations. Memories default to private and become public only through an
explicit user action. Treat every table as user-owned until proven otherwise.

## Verify

- **RLS is enabled** on every table holding user-owned data, and a default-deny
  posture applies before policies are considered.
- **Cross-user isolation** — a user cannot read, insert, update or delete another
  user's private Memories, assets, palettes, pairings, collections or notes. Check
  `USING` and `WITH CHECK` separately; a missing `WITH CHECK` allows writes that
  the read policy would have blocked.
- **Public memories expose only intended fields.** Publishing must not leak the
  personal note, precise location, raw EXIF or the owner's private identifiers.
  Prefer a view or an explicit column list over `select *`.
- **Storage objects follow equivalent access rules** — bucket policies mirror table
  policies, private media is not publicly readable, storage paths are never exposed
  directly, and signed URLs are used where appropriate with a sane expiry.
- **Service-role credentials are server-only.** No service key in mobile or web
  client bundles, env files shipped to clients, or Edge Function responses.
- **`SECURITY DEFINER` functions** are justified, have a pinned `search_path`, and
  do not become an RLS bypass.
- **Migrations are reversible or safely forward-fixable**, ordered, and do not drop
  or rewrite user data without an explicit plan.
- **Required indexes exist** for the policy predicates and the timeline, search,
  filter and discovery query paths — an RLS predicate on an unindexed column is a
  performance trap.
- **Delete and data export behavior are defined** — account deletion removes or
  anonymizes rows and storage objects across every table; export produces the
  user's own data only.

## Deliver

Create tests or SQL assertions for critical policies. At minimum, prove for each
user-owned table that user A cannot read or mutate user B's rows, and that a
published Memory exposes only the intended columns.

Report findings by severity, with the exact policy, table or migration involved.

## Never

- Never solve an access failure by disabling RLS, adding a permissive
  `using (true)` policy, or moving the query to the service role to make it pass.
  Fix the policy or the query.
