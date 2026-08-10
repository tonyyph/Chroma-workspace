# 03 · Information architecture

## The existing graph, and what is wrong with it

Today: four tabs — **Library · Explore · Sets · You** — with capture as a raised
centre button opening a modal, plus 10 `tools/*` routes and a `trending` route
pushed from Library.

Three problems for the restored product:

1. **Two of four tabs are professional colour tooling.** Sets is a merge
   workbench; Explore is a palette search. A consumer opening the app sees a
   filing cabinet.
2. **There is no home for return.** Library is an archive, not a reason to open
   the app on a Tuesday. The product's whole second act — rediscovery — has
   nowhere to live.
3. **Nothing in the IA is about sound.** Which is the point of the product.

## The new graph

**Four tabs, capture stays centre.** Not five. Every candidate fifth tab
(Collections, Discover, Player) loses to keeping the row readable at 320pt with
Vietnamese labels and a 56pt raised action in the middle.

```
┌─────────────────────────────────────────────────────┐
│  Today        Memories      ◉        Collections   You │
└─────────────────────────────────────────────────────┘
                            capture
```

| Tab             | Route                | Was       | Holds                                                                                            |
| --------------- | -------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| **Today**       | `(tabs)/index`       | _new_     | On this day · continue an unpaired memory · a palette-and-sound journey · this week's field note |
| **Memories**    | `(tabs)/memories`    | Library   | The archive. Month bands, search, filters, paired/unpaired                                       |
| **◉ Capture**   | `capture` modal      | unchanged | Camera · import                                                                                  |
| **Collections** | `(tabs)/collections` | Sets      | Consumer collections; Working Set mode inside one                                                |
| **You**         | `(tabs)/you`         | unchanged | Preferences, skin, audio, privacy, Pro, colour tools index                                       |

**Explore is absorbed.** Its search and discovery filters move into Memories as a
search field and filter rail, which is where users look for them. Its route
survives as a redirect so no deep link breaks.

**`tools/*` stays where it is** — ten routes, unchanged, now indexed from a
"Colour tools" section in You rather than from the most-visited screen. They are
professional utilities; they should be findable and should not greet anyone.

**Why Today is the first tab.** The capture flow is one button away from
everywhere. What the app lacked was a reason to _open_ it when you have no photo
to take. Today answers that with the user's own past — which is also the only
engagement surface that does not require us to manufacture novelty.

## Route map

```
app/
  index                       redirect → onboarding | (tabs)
  onboarding                  new: ends with the user's first memory
  (tabs)/
    _layout                   TabBar, capture centre
    index                     Today
    memories                  Memories
    collections               Collections
    you                       You
  capture                     modal · camera / import
  capture/analyse             staged progress (palette → atmosphere → music)
  capture/pair                recommendation comparison + preview player
  capture/result              name, note, save
  memory/[id]                 Chromatic Memory detail
  memory/[id]/pair            re-pair or replace track (same component as capture/pair)
  collection/[id]             collection detail · Working Set mode inside
  collection/new
  journey/[seed]              continuous colour-to-music playback
  paywall                     modal
  trending                    field notes (unchanged)
  tools/*                     ten colour tools (unchanged)
  explore                     redirect → (tabs)/memories
```

`palette/[id]` **redirects to** `memory/[id]`. Every v1 palette becomes a memory
(see `09`), so the id space is continuous and existing deep links and the daily
notification route keep working.

## Screen hierarchy

Three levels. Nothing is four taps deep.

```
L0  Tabs                    Today · Memories · Collections · You
L1  Objects                 memory/[id] · collection/[id] · journey/[seed]
L2  Acts on an object       pair · tune · export · working-set mode · share
```

Capture is orthogonal — a modal stack that can be entered from L0 or L1 and
always returns to the memory it produced.

## Capture stack

```
capture  ──shutter/import──▶  capture/analyse  ──▶  capture/pair  ──▶  capture/result
                                    │                    │                   │
                            palette ready            skip music         save memory
                                    └────────────────────┴──────▶ memory/[id]
```

Two escapes from every step:

- **"Save colours only"** is available from `analyse` onward. It produces a valid
  unpaired memory. This is the offline path and the AI-failure path, and it is a
  first-class button, not a fallback link.
- **Back** discards the pending capture, as it does today
  (`captureStore.discard`).

`capture/pair` is the same component as `memory/[id]/pair`. Pairing at capture
time and re-pairing six months later are the same act; building them twice is how
they drift.

## What the tab bar must gain

`ui/TabBar.tsx` currently maps four keys to four routes. It needs:

- new keys `today | memories | collections | you`;
- **a playback indicator** on the bar itself when a preview is playing, so audio
  is never orphaned by navigation. A 2pt progress hairline across the bar's top
  edge in Chroma; a filled tick in the Swiss rule. Not a mini-player — the
  player lives in the pairing screen and on memory detail, and a persistent
  global player would be a Spotify affordance in a product that is not one.

## Navigation invariants

1. Capture is reachable in one tap from every L0 screen.
2. Audio stops when the screen that owns it is popped. Exactly one preview plays
   at a time, enforced in the audio service, not in screens (`11`).
3. No screen requires network to render. Every screen has a defined offline
   presentation (`04`).
4. The paywall is never on the path to the first saved memory.
5. Deep links `palette/[id]`, `explore`, and the notification route all resolve.
