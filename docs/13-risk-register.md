# 13 · Risk register

Ranked by expected loss — likelihood × cost of being wrong. Owner column names
what resolves it, not who.

## R1 · Destroying an existing user's saved palettes — **critical**

`StoredPaletteRepository.list()` calls `paletteListSchema.parse` on the whole
array and throws on any invalid record, and `schemaVersion` is `z.literal(1)`.
A migration bug does not corrupt one palette; it makes the entire library
unreadable.

**Mitigation:** v1 key never written or deleted; per-record `safeParse`;
whole-migration abort if any produced memory fails validation; quarantine rather
than drop; idempotent and re-runnable; eleven named tests in `09`.
**Residual:** low. **Resolved by:** `09` tests green before Phase 2.

## R2 · Provider terms change and break preview playback — **high**

Precedent: Spotify removed `preview_url` for new apps on 2024-11-27 and killed
the obvious design for this product. iTunes or Deezer could do the same.

**Mitigation:** `MusicProvider` abstraction from day one; three adapters mapped;
`'none'` provider degrades honestly; memories store _metadata_, never preview
URLs, so a provider change cannot break saved data — only new playback.
**Residual:** medium, structurally contained. **Resolved by:** nothing; monitored.

## R3 · iTunes preview usage outside Apple's promotional terms — **high**

Apple permits previews and artwork **to promote store content**, proximate to a
store badge. A music-discovery app is a defensible fit; it is not a certainty,
and this has not been legally reviewed.

**Mitigation:** every card and track block carries a store link adjacent to the
play control; attribution rendered from the model so a screen cannot omit it; a
test asserts no card renders without its link; no audio cached or re-hosted.
**Residual:** medium. **Resolved by:** legal review of Apple's Services
Performance Partners terms before public release. **This is a release blocker,
not a build blocker.**

## R4 · A dozen screens have never been seen running — **high**

Library, palette detail, capture result, Working Sets, chromatic adaptation, hero
transition and the entire Swiss skin are Implemented and unverified. The hero
transition's _computed_ landing position is the specific worry. Building the
music UI on top multiplies the debugging surface.

**Evidence this is real:** two regressions last session were caught by lint
warnings rather than tests; a worklet-calling-non-worklet bug reached device
because Jest mocks Reanimated; and this session found a live appearance leak
shipping chroma's pill radius into Swiss.
**Mitigation:** device pass is Phase 2's exit criterion, before Phase 3.
**Residual:** high until a simulator run happens.

## R5 · The match is unconvincing — **high, product-level**

If recommendations feel arbitrary, no amount of engineering saves the product.
Ranking is intent-to-_query_ matching over keyword search; we cannot measure a
track's true valence or energy, because the endpoints that once exposed them are
restricted (`06`).

**Mitigation:** curated mood × energy → genre table, editable by a human, not
arithmetic; reasons cite only dimensions actually measured — colour, light,
atmosphere — never a fabricated audio feature; feedback biases subsequent runs;
"Try again" rotates the seed; manual search always available.
**Observed on device, 2026-08-11 — the risk is real and it has a shape.** Query
quality is not uniform; it tracks how _distinctive_ the genre term is:

| Palette      | Genre queried | What came back                                              |
| ------------ | ------------- | ----------------------------------------------------------- |
| dark, cool   | `shoegaze`    | Slowdive · Cocteau Twins · Beach House · Pale Saints        |
| high chroma  | `krautrock`   | Kraftwerk · Tangerine Dream · Faust · Kikagaku Moyo         |
| warm, bright | `ambient`     | "Ambient (Sound Healing)" by _Reiki_ · "Minway Meditations" |

Narrow, scene-defining terms return canon. Broad wellness-adjacent terms return
the catalogue's long tail of generic production music — technically the right
genre, and nothing anyone would call a match.

**The fix is curatorial, not algorithmic.** `CURATION` in `intent.ts` is a table
precisely so this is one edit: the serene/low row should lead with terms that
have a canon behind them (`modern classical`, `fourth world`, `kankyō ongaku`)
rather than `ambient`, which is now a wellness-catalogue keyword as much as a
genre. The same audit is owed to every row.

### The audit, done — 2026-08-11

Every one of the ~40 terms in `CURATION` was queried against the live VN
storefront and judged on what came back. Three defects, each found only by
looking:

1. **Single common nouns fail.** `ambient` · `new age` · `piano` · `funk` ·
   `house` · `disco` · `soul` · `gospel` · `bossa nova` · `indie folk` ·
   `noise rock` and a dozen more returned production music, the wrong genre, or
   title collisions — `funk` returned Brazilian funk producers, `house` returned
   Beach House. Compound and subcultural names return canon. The table now uses
   only measured terms, and `intent.test.ts` bans the failures by name.

2. **Warmth was being discarded.** `CURATION` is keyed on mood and energy alone,
   so a cold grey rain and a warm sunlit kitchen both read `serene` at low energy
   and produced _the same five tracks_. Temperature now rotates the genre list,
   giving them different leads and different candidate pools. The real fix is
   warm/cool variants of each mood; that would re-label saved memories, so it is
   deferred and noted.

3. **Genre provenance cannot tell a genre from a word.** `dream pop` surfaced two
   K-pop singles called "Dream"; `chamber music` returned four tracks titled
   "Chamber Music". `RANKING_WEIGHTS.titleEcho` demotes a candidate whose title
   echoes the searched term's head word.

Measured before and after, same four palettes:

| palette      | before                               | after                                             |
| ------------ | ------------------------------------ | ------------------------------------------------- |
| warm, bright | "Ambient (Sound Healing)" by _Reiki_ | Philip Glass · Jóhann Jóhannsson · Bruce Brubaker |
| dark, cool   | Pale Saints · Beach House            | Beach House · Slowdive · Cocteau Twins            |
| high chroma  | Tangerine Dream · "Punk" by Gazzelle | Tangerine Dream · Kraftwerk · Kikagaku Moyo       |
| grey, flat   | _identical to warm, bright_          | Ryuichi Sakamoto · Mozart · Vivaldi               |

**Residual:** medium. The engine now returns records people would recognise, and
the remaining judgment — whether _this_ record suits _that_ photograph — is the
part only listening can settle. **Resolved by:** qualitative testing on real
photographs.

## R6 · A secret ends up in the bundle — **high if it happens**

`EXPO_PUBLIC_*` variables are compiled into the bundle in plaintext. A MusicKit
.p8, or a model key, shipped this way is a credential leak on every install.

**Mitigation:** the default configuration needs **no secret at all**; secrets
exist only behind the edge function; a test scans the bundle-reachable source for
key-shaped literals and for `EXPO_PUBLIC_` names carrying anything secret-like.
**Residual:** low.

## R7 · Library performance collapses under filtering — **medium-high**

Measured: ~10⁶ CIEDE2000 calls per recompute on a 500-item library, on **every
search keystroke** (`01 §13`). Adding mood/colour/genre filters multiplies it.

**Mitigation:** month signatures cached by membership hash; filtering on
precomputed scalar `facets`, never colour maths; grouping memoised on filtered
ids. Ships _before_ the filters, per `12` Phase 2 item 9.
**Residual:** low once done. **Measured by:** `14`.

## R8 · Swiss becomes chroma with the effects off — **medium**

The two-skin architecture is genuine, but music surfaces are new and the lazy
path is to give Swiss the same layout in different colours. That would waste the
architecture and produce a worse product than one skin.

**Mitigation:** `10` specifies Swiss's music surfaces as _different forms_ —
specimen strip, record note, rule progress, pull quote. The stated test: two
screenshots of the same memory must differ in layout, not only in palette.
**Residual:** medium — this needs design judgment, which no test supplies.

## R9 · Autoplay surprises the user — **medium**

Unexpected audio in a quiet room is the fastest way to lose trust, and it is a
plausible App Store complaint.

**Mitigation:** never autoplay the first preview; opt-in only after a deliberate
play; preference persisted; audio session activated at first play, not launch;
audio stops on unmount; no background audio mode.
**Residual:** low.

## R10 · Vietnamese becomes a machine translation — **medium**

424 keys today with enforced parity and per-control width budgets. Music copy
adds emotional register, where literal translation reads worst.

**Mitigation:** vocabulary fixed in `02` with reasoning ("ký ức" not "bộ nhớ");
structured `reasons[]` localised as sentence templates rather than translated
prose; existing expansion budgets extended to new controls; long-VI metadata is a
named verification case.
**Residual:** medium. Needs a native speaker's review, which tests cannot give.

## R11 · Working Sets users lose their tool — **medium**

Existing palettes and sets belong to people who used a colour instrument.

**Mitigation:** every v1 palette migrates losslessly; `PaletteRepository` and
`SetRepository` survive as projections so all ten tools compile and pass
unchanged; Working Set mode keeps every capability, one tap deeper.
**Residual:** low technically; medium in perception.

## R12 · No visual regression strategy for a two-skin product — **medium**

339 tests, none can see a screen. Every UI claim in Phase 3 rests on manual
screenshots.

**Mitigation (proposed, `14`):** resolved-style snapshots per skin as the cheap
first step; a screenshot harness as the real answer. The cheap step catches token
drift; only the real one catches worklets.
**Residual:** medium.

## R13 · Scope — rebuilding everything before the slice works — **medium**

Fifteen documents describe a large product. The failure mode is redesigning nine
screens and discovering at the end that previews do not play.

**Mitigation:** Phase 2 is one journey and explicitly forbids secondary screens;
Phase 3 is gated on Phase 2 being _Verified_, not merely built.
**Residual:** low if the gate is honoured.

## R14 · Paywall that cannot take money — **low, but it is a lie**

`PaywallScreen.tsx:128` — the buy CTA calls `router.back()`.

**Mitigation:** treated as a bug. Until real billing exists the screen states
plainly that purchasing is unavailable. No simulated success, ever.
**Residual:** low.

## R15 · Live read still claimed but non-existent — **low**

`PaletteSource` accepts `'live'`; `tools/spike-liveread.tsx` (350 LOC) has never
been run; Vision Camera worklets do not compile against RN 0.83's prebuilt pods.

**Mitigation:** no live-read claim in any copy; `'live'` never written; the probe
is decided in or out on a physical device and the dead route deleted either way.
**Residual:** low.
