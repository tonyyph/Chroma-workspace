# 06 — Remix and privacy model

**Status:** accepted (decision D5, 2026-08-17). Implementation is Phase 7 (last).

---

## 1. Decision

**Specify the API. Build local, private remixing only. Ship no community
surfaces until real users exist.**

There is no backend, no authentication and no user identity in this application.
Verified, not assumed: **exactly one `fetch()` call exists in the entire
codebase** — `trendingRepository.ts:152`, reading an optional static JSON file of
editorial content. Unset, the app never touches the network.

---

## 2. Three concepts that must never be one

The brief is right that these are distinct, and conflating them is how private
media leaks.

| Concept                    | Contains                                                                                  | Leaves the device           |
| -------------------------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| **Private source project** | the user's photographs, their crops, their edits, draft metadata                          | **never**                   |
| **Public rendered result** | the exported PNGs, and only those                                                         | only on an explicit publish |
| **Remix recipe**           | structure — slide count, layout, palette, animation ids, typography roles, element frames | only on an explicit publish |

A remix recipe **carries no media and no asset URIs**. It is the shape of a
composition, not its contents. That is what makes remixing safe: someone remixing
your story gets your _structure_ and supplies their own photographs. There is no
code path by which a remix hands over a source file, because the recipe schema
has nowhere to put one.

---

## 3. What publishing means, and what it does not

A user may publish a finished story, a reusable composition, a palette, an
animation configuration, or a music reference.

**Never published without a separate, explicit, per-item consent:** original
photographs, editable source assets, draft metadata, `sourceMemoryIds`, personal
notes, captions the user did not choose to include, or location.

Publishing is not a toggle buried in a settings screen. It is an action with a
screen that says what is being shared, in the two languages the app ships.

---

## 4. Attribution

Tracked on every remix:

- the original creation id and its creator;
- the remix chain, **depth-bounded** — an unbounded chain is a recursive load and
  a denial-of-service on the device;
- the composition version, so a recipe that changed later is identifiable;
- which parts the remixer modified;
- the publication timestamp.

Displayed clearly, and **not silently removable**. Prevented by construction:
copying private assets (nowhere in the recipe to put them), broken remixes when
an original is deleted (the recipe is self-contained, not a pointer), leaking
draft metadata (not in the schema), and unbounded chain loading (depth cap).

---

## 5. What Phase 7 actually builds

1. `remixRecipe` schema in `packages/domain/src/story/` — versioned, zod, with the
   same invariant discipline as `storyProject`.
2. `toRecipe(project)` — strips every asset reference and every private field.
   **A test asserts that no recipe ever contains a URI**, mirroring the existing
   test that asserts no audio URL appears in a serialised memory.
3. `applyRecipe(recipe, assets)` — builds a new project from a recipe plus the
   remixer's own photographs.
4. Local remixing: remix your own stories, keep the chain, edit before finishing.
5. The documented server API in §6, implemented by nobody yet.

**Not built:** publish, upload, accounts, Trending Remixes, Rising Creators, By
Color / By Mood / By Track / By Template feeds, counters of any kind.

---

## 6. The API a backend would have to provide

Recorded so the decision is a decision, not a rewrite.

```
POST   /compositions            { recipe, renderedSlides[], attribution }  → id
GET    /compositions/:id        → { recipe, renderedSlides[], attribution, createdAt }
GET    /compositions/:id/chain  → ancestors, depth-capped
POST   /compositions/:id/remix  { recipe, attribution } → id
DELETE /compositions/:id
GET    /discover?axis=color|mood|track|template&cursor= → page
```

Requirements any implementation must meet: authenticated identity; per-item
publish consent recorded server-side; moderation before anything is discoverable;
a real delete that removes the rendered result, not a soft flag; rate limiting;
and **no counter that is not a count of something real**.

`trendingRepository` is already written so that the day it reads an endpoint,
"the change is this file and nothing above it" — the read side is deliberately
asynchronous and cancellable even over a local array, because "a screen written
against a synchronous feed acquires loading and error states that are lies."

---

## 7. Why no fake community, stated once

This codebase has already made and reversed this mistake.
`trendingRepository.ts:24-31` records that sorting by `saves` was removed because
it was "a number somebody typed into a fixture — fabricated social proof for a
feed with no users behind it," and `featured` replaced it because editorial order
"is a real editorial decision and the only ranking this content actually has."

Re-introducing invented engagement to make Discover look inhabited would undo a
correction the team already paid for.

---

## 8. Privacy posture, unchanged

Local-first stays the default. The user must be able to understand what is used,
opt out, recalculate, delete derived data, keep everything private, and choose
explicitly what is shared. Analytics for remix carry ids and counts — never
media, captions, palettes or prompts.
