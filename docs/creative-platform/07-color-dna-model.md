# 07 — Color DNA model

**Status:** partially built. Phase 6 completes it. Decision D6 is **open**.

---

## 1. What already exists

Roughly 60% of this feature is implemented, tested and wired — a fact worth
stating plainly, because the brief describes it as new work.

| Built                                                           | Where                                   |
| --------------------------------------------------------------- | --------------------------------------- |
| Recency-weighted taste profile, 90-day half-life                | `domain/styleDna.ts:readStyleDna`       |
| Signature colours, moods, colour-moods, styles, genres, artists | `styleDna.ts`                           |
| Warmth / luminosity means, paired share                         | `styleDna.ts`                           |
| Smart collections by month, mood, colour, artist, genre         | `domain/rewind.ts:smartCollections`     |
| On-this-day                                                     | `rewind.ts:onThisDay`                   |
| Month and year recaps                                           | `rewind.ts:recapFor`, `availableRecaps` |
| Screen                                                          | `features/rewind/RewindScreen.tsx`      |
| Signature strip on the You tab                                  | `features/you/youInsights.ts`           |

**Derived, never stored.** `styleDna.ts` states the three reasons: one source of
truth, deleting a memory genuinely removes its influence, and changing how taste
is read takes effect immediately rather than only for future captures. "A
persisted profile would be a second truth that slowly stops matching the library
it claims to describe."

This also makes the privacy requirements in §5 nearly free: there is no derived
store to delete.

---

## 2. What is missing

1. **A shareable recap story** — the natural bridge to Story Studio: a recap
   becomes a `StoryProject` the user can edit and export.
2. **Explanation copy** — the readable sentences the brief asks for.
3. **Opt-out, recalculate and delete UI** — see §5.
4. **Two parallel implementations to consolidate.** `domain/styleDna.ts` and
   `features/you/youInsights.ts` both define `TasteEntry` with _different shapes_
   (`weight`+`count` vs `count`+`share`) over _different inputs_ (`ChromaticMemory`
   vs `Palette`). This must become one, not three.
5. **The annual recap** — architecture only until a full year of data exists.

---

## 3. Decision D6 — still open

**Seasons and location are not derivable, and the recommendation is to drop
both.**

`rewind.ts:14-19` already refuses seasons, and the reasoning is sound: "A season
is not a property of a date: December is summer for half the world. The app knows
a `location` only as free text a person typed, never as a coordinate, so it
cannot know a hemisphere and would have to guess. Months are the honest form of
the same idea — 'your Augusts' says something true everywhere."

Location is disabled by design: `app.json` sets
`isAccessMediaLocationEnabled: false`, so the app cannot read photo GPS at all.
Adding location patterns means reversing a deliberate privacy decision and
requesting a permission the product has so far refused.

Grouping by person is absent for a related reason: there is no face data, and
adding some "is a different project with its own privacy cost."

**Recommendation:** keep the month-based framing, drop seasonal and location
patterns from scope. This is the product owner's call and is not yet made.

---

## 4. Explanations, and their honest limits

The brief's examples are the right register:

> "You used deep blue most often in evening memories."
> "Warm tones were frequently paired with energetic tracks."

Both are **descriptions of the user's own records**, and both are true or false
by counting. That is the bar.

**What must never be said:** anything implying psychological insight. "You are
drawn to blue because you are calm" is not derivable from a photo library, and
the app has no standing to say it.

Three rules:

1. **Report counts, not causes.** "In 12 memories" rather than "you tend to".
2. **Suppress weak signals.** `rewind.ts` already sets `MINIMUM_MEMBERS = 3`
   because "two memories that happen to share a mood is not a thing worth naming."
   The same floor applies to every explanation.
3. **Name the correlate honestly.** `facets.energy` is derived from _colour_, not
   from audio (ADR 04). A sentence pairing "warm tones" with "energetic tracks"
   must not imply the energy was measured from the music.

---

## 5. Privacy

Because the profile is derived, most of this is already true; the UI has to make
it visible.

| Requirement             | How                                                                 |
| ----------------------- | ------------------------------------------------------------------- |
| Understand what is used | a plain-language screen listing the inputs — all of them local      |
| Opt out                 | a preference that stops computing and hides the surfaces            |
| Recalculate             | already true on every read; the control makes it legible            |
| Delete derived data     | nothing to delete — deleting a memory removes its influence at once |
| Keep it private         | the default, and the only current state                             |
| Choose what is shared   | per-item on a recap story, never a bulk toggle                      |

**Never in a public card or in analytics:** location, private captions or notes,
raw capture history, listening behaviour, or the full palette history. A shared
recap carries the colours and the counts the user chose to include, and nothing
that identifies a specific memory they did not.

---

## 6. Nothing is uploaded to compute this

All of it is pure functions over records already on the device: no network, no
provider, no cost. The brief's instruction — do not upload private media to
calculate statistics that can be computed locally — is satisfied by construction
rather than by policy.

---

## 7. Tests Phase 6 must add

Aggregation correctness at the recency thresholds; the `MINIMUM_MEMBERS` floor;
deletion of a memory removing its influence from every collection at once;
opt-out suppressing every surface; a shared recap containing no location, note or
caption the user did not select; and the consolidated `TasteEntry` producing the
same numbers the two implementations produced where they agreed.
