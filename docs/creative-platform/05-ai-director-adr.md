# 05 — ADR: AI Story Director

**Status:** accepted. Implementation is Phase 5.

---

## 1. Decision

**The AI returns a validated patch against a document the app already built. It
never returns a document, and never returns anything executable.**

Order of operations, and it is not negotiable:

1. A **deterministic local composer** builds a complete, valid `StoryProject`
   from the selected memories — ordering, pacing, crops, palette progression.
   This is a real feature on its own and ships first.
2. If a provider exists, it is offered that baseline and may return a **patch**:
   a bounded set of changes to slides, order, crops, layout ids and captions.
3. The patch is validated field by field. Anything unknown, out of range, or
   referring to an asset the caller did not supply is **dropped**, not repaired
   into something plausible.
4. The result is a **proposal**. The user previews, accepts, regenerates, changes
   mood, preserves chosen slides, or undoes — the application is one history
   entry like any other edit.

---

## 2. Why a patch, not a document

`packages/domain/src/analysis.ts` already solved this problem once and its two
helpers are the whole argument:

- **`acceptRefinedIntent(candidate, baseline)`** — all-or-nothing zod validation
  with fallback to a locally computed baseline. A malformed response costs
  nothing because the baseline was already correct.
- **`retainKnownExplanations(explanations, candidates)`** — drops any id the
  caller did not supply, so "a model cannot add a track to this pipeline… that is
  a property of the types, not a promise in a prompt."

A model returning a whole document would have to be trusted about element ids,
asset references, canvas dimensions and the weights-sum-to-one invariant. A model
returning a patch against a valid document can only ever make it _differently_
valid, because every field it touches is re-validated against the schema that
already governs that document.

---

## 3. What may be proposed

Bounded, closed sets — never free-form structure.

| Proposal            | Constraint                                                  |
| ------------------- | ----------------------------------------------------------- |
| Slide count         | 1–20, and never more than the media supplied                |
| Media order         | a permutation of the assets given, nothing added            |
| Focal image         | must be one of the supplied asset ids                       |
| Crop                | a normalised rect inside `[0,1]`, validated by `cropSchema` |
| Layout              | a known layout id from a closed enum                        |
| Palette progression | colours from the memories' own palettes                     |
| Typography          | a `TextRole`, never a font name or a pixel size             |
| Caption             | ≤280 chars, and see §5                                      |
| Animation style     | a known preset id                                           |
| Export format       | a `StoryFormatId`                                           |

Rejected outright: unknown element kinds, missing assets, invalid dimensions,
inaccessible text colours (checked with the domain's own `readableOn`), elements
outside the reachable bounds, unsupported animations, unavailable music
references, invalid template ids.

**AI must not generate React Native code.** There is no path by which a response
becomes anything but data validated against a schema.

---

## 4. Privacy and cost

**No private media leaves the device without an explicit, separate consent.**
`analysis.ts` already specifies what an analysable image is: "longest edge ≤1024,
JPEG q0.7, EXIF stripped, no location." That specification stands.

Never sent, under any consent: exact location, private captions, notes, the
user's full palette history, listening behaviour, or the contents of other
memories. Analytics must never carry an AI prompt.

The app is local-first by design (`.env.example`: "Cloud integration is
intentionally disabled") and has no backend, so a provider means the first
outbound path for user content in the product's history. That is a product and
privacy decision, not an implementation detail, and it needs its own approval
before any client is written.

Offline and failure behaviour is the baseline: the local composer's result, with
the failure stated. **No spinner that never resolves, and no silent fallback that
presents local output as an AI result.**

---

## 5. Naming honesty

If no provider is configured, the feature is the **local composer** and is called
that. Shipping a deterministic heuristic under an "AI" label is the exact
fabrication `domain/analysis.ts` refuses for `visualAnalysis`, which is `null` on
every real memory rather than filled with a guess.

Captions are the sharpest case. A generated caption placed on someone's memory
carries an implied claim about _their_ experience. Captions are opt-in, always
editable, never applied silently, and never presented as something the app knows
about the moment.

---

## 6. Consequences

**Good.** The local composer is a shipped feature whether or not a provider ever
arrives. A malformed or hostile response cannot corrupt a document. The
validation surface is the schema that already exists.

**Accepted.** The AI's influence is bounded — it cannot invent a layout the app
does not have. That is the point, not a limitation to work around.

---

## 7. Status of the provider decision

**No AI provider exists in this repository** (audit §8): no Anthropic, OpenAI or
HTTP AI client, and the shipped `NullImageUnderstandingProvider` throws
`AnalysisUnavailableError`.

Choosing one is an open product, privacy and cost decision that is **not** part
of Phase 5's engineering. Phase 5 builds the local composer, the patch schema and
the validation. The provider is a later, separately approved step.
