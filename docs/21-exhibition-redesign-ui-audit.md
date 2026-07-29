# Exhibition redesign UI/UX audit

Audit date: 2026-07-28. Target: native iOS development build on iPhone 16 Plus
Simulator. Source: CHROMAWAVE Product Blueprint, especially the Collection,
sharing, positioning, screen inventory, and semantic-token sections.

## Outcome

The implemented shell now reads as one curated product rather than a stack of
equal cards. Today establishes the emotional thesis, artwork supplies depth,
raised trays expose only the next useful information, and the floating five-point
dock makes Capture the unmistakable primary action. Atelier expands the app
without displacing Memory as the central object.

## Evidence

- [Today exhibition hierarchy](./evidence/ios-redesign-today.png)
- [Atelier and Palette Signature](./evidence/ios-redesign-atelier.png)
- [Settings atmosphere hero](./evidence/ios-redesign-settings.png)
- [Capture hero and raised action tray](./evidence/ios-redesign-capture.png)
- [Memory detail](./evidence/ios-redesign-memory-detail.png)
- [Memory Remix, Share, and Collections actions](./evidence/ios-redesign-memory-actions.png)

## Capability expansion

1. Collections persist locally as validated aggregates and support creating a
   collection plus adding or removing Memories.
2. Monthly Recap derives the current period's count, dominant mood, and signature
   colors from the Memory archive.
3. Palette Lab derives brightness, saturation, warmth, harmony, and a six-color
   signature without persisting redundant state.
4. Share Studio invokes the native share sheet with a private text moodboard; it
   does not transmit the local photo URI.
5. Remix requests another typed music recommendation and persists only the new
   pairing.

## Audit matrix

| Dimension             | Result | Evidence                                                                                                                                                            |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual hierarchy      | Pass   | Each primary viewport has one dominant statement; supporting data is grouped in one raised tray rather than multiple competing cards.                               |
| Layout                | Pass   | The floating dock remains above scroll content, respects the safe area, and keeps five destinations stable even when the app opens through a deep link.             |
| Brand distinctiveness | Pass   | Editorial serif typography, chromatic artwork, asymmetric overlap, numbered sections, and the center BrandMark produce a recognizable CHROMAWAVE silhouette.        |
| Color                 | Pass   | Six full semantic atmospheres replace isolated color swaps; extracted palette colors remain decorative and do not drive body-copy contrast.                         |
| Interaction           | Pass   | Capture is the visual center; all dock targets are at least 44 points, Collections use checkbox semantics, and actions expose loading or error states where needed. |
| Motion                | Pass   | Dock entry motion is short and disabled when Reduce Motion is active; the redesign does not add decorative looping motion.                                          |
| Localization          | Pass   | The dock, Atelier, feature actions, atmosphere names, empty/error states, and accessibility labels are available in English and Vietnamese.                         |
| Privacy               | Pass   | Collections stay local, derived insights require no network request, and Share Studio excludes the local asset URI.                                                 |

## Verification evidence taxonomy

- **RUNTIME:** Today, Atelier, Settings, Capture, and Memory detail were opened in
  the native iOS development build. The dock overlap defect found during this pass
  was corrected with an isolated top navigation layer and rechecked after a cold
  relaunch.
- **SOURCE:** The five capabilities are wired through domain schemas, repositories,
  hooks, typed analytics, localization, and UI actions. The six themes use semantic
  tokens rather than per-screen hard-coded palettes.
- **TEST:** Workspace typecheck, lint, tests, and formatting pass. Domain reports 15
  passing tests; mobile reports 12 passing tests, including Collection schema
  derivation and repository round-trip/malformed-storage cases. Expo dependency
  validation reports all packages up to date.
- **GAP:** Physical-device haptic feel, delivered-notification presentation, native
  share-target behavior, very large Dynamic Type, compact iPhone, and iPad still
  need device-matrix QA. Simulator screenshots do not close those checks.
