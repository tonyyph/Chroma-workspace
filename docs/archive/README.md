# Archive

Superseded documents. Kept for provenance, not for guidance. **Nothing here is
current.** The canonical set is `docs/00-` … `docs/14-`.

## The v1 Chromawave documents (`00`–`17`)

Written for the original colour-and-music product. Most described a `Memory`
aggregate, a Spotify adapter and a pairing engine **that were never built** — the
code went a different way and the documents were never retired.

**The music vision in these files is not abandoned.** It is restored, verified
against what providers actually permit in 2026, and re-specified in
`docs/02-restored-chromawave-vision.md` onward. What is archived is the specific
*shape* these documents proposed, not their intent.

Two are worth reading for their reasoning:

- **`09-pairing-engine.md`** — a seven-step deterministic pipeline ending "No
  large language model is required." This was right, and it is the backbone of
  `docs/06-ai-recommendation-architecture.md`. Restoring the vision did not mean
  adopting an LLM-first design; the original design was better.
- **`08-music-provider-architecture.md`** — correctly insisted on a
  provider-neutral boundary with token refresh kept out of components. Carried
  forward into `docs/07-music-provider-feasibility.md`.

Superseded on facts rather than intent:

- `00-product-brief.md`, `02`, `03`, `04`, `14`, `15`, `16`, `17` — describe a
  domain model and roadmap the code never had.
- `10-security-privacy.md` — its "no network upload" position no longer holds for
  optional AI analysis. See `docs/08-privacy-and-backend-decision.md`.
- `05`, `06`, `07`, `11`, `12`, `13` — partly true, but written before the skin
  architecture existed.

**Do not cite these as evidence about the codebase.** Their inaccuracy cost real
audit time twice.

## UI audit cycles (`18`–`21`, `23`)

Point-in-time notes from redesign passes. Historical.

## Project review (`25`)

`25-project-review-and-phase-plan.md` was the most useful document in the
repository and is the direct ancestor of the current set. Its engineering
judgment was sound. Its numbers were stale, and one was materially wrong:

> "Baseline to hold: 0 type errors · 339 tests · 11 lint warnings · 8 format files."

Verified at `a7be7bb`: **a test was failing** (`no-appearance-leaks` —
`LibraryScreen` imported chroma's `round` scale and applied `round.full` to the
month band, so Swiss rendered a pill on a paper ground), and lint had 12
warnings, not 11. Both fixed or recorded in `docs/01-current-product-audit.md`.

Its central recommendation — verify unseen work before building on top of it —
is adopted as Phase 2's exit criterion in `docs/12-implementation-plan.md`.

## Still authoritative, moved not archived

- `docs/reference/build-kit.md` — the BUILD KIT. Source code comments cite its
  section numbers throughout (`BUILD KIT · 07 · CORE MODEL`).
- `docs/reference/brand-mark-system.md` — the mark, and how it is generated.
