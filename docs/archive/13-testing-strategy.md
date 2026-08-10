# Testing strategy

- Domain unit tests: OKLab conversion, clustering, mood, contrast, pairing, and
  entitlements.
- Schema tests: reject invalid or privacy-unsafe aggregate shapes.
- Repository tests: round-trip, newest-first ordering, corrupt storage behavior.
- Component tests: state views and critical accessible actions.
- Navigation smoke test: first route and capture-to-detail route availability.
- Manual device check: permission prompt, representative images, animation,
  persistence after relaunch, and reduced motion.

Tests assert observable contracts rather than component internals. Supabase policy
tests and provider contract tests begin when those adapters exist.
