# Settings feature and UI audit

Audit date: 2026-07-28. Target: native iOS development build on iPhone 16 Plus
Simulator.

## Runtime evidence

- [Obsidian Settings](./evidence/ios-settings-obsidian.png)
- [Vietnamese Settings](./evidence/ios-settings-vietnamese.png)
- [Six-theme gallery](./evidence/ios-settings-themes.png)
- [Ivory theme in Vietnamese](./evidence/ios-settings-ivory-vietnamese.png)
- [Notification enabled with reminder times](./evidence/ios-notification-permission.png)
- [Preferences restored after cold relaunch](./evidence/ios-settings-persisted.png)

## Implemented vertical slice

- A versioned `UserPreferences` aggregate validates language, theme, haptics,
  notification state, notification identifier, and reminder time.
- AsyncStorage persists preferences locally and rejects invalid stored values without
  silently overwriting them.
- Six semantic themes apply to screens, navigation, typography, controls, artwork,
  cards, forms, and status-bar mode: Obsidian, Ivory, Oxblood, Cobalt, Moss, and
  Aubergine.
- English and Vietnamese switch immediately across onboarding, all primary tabs,
  capture/review/palette/pairing/compose, Memory detail, empty/error states, and
  accessibility hints.
- Haptic feedback is routed through one preference-aware service.
- Notifications use the native Expo Notifications module, request OS permission, keep
  one replaceable daily local schedule, localize its copy, and expose 18:00, 20:00,
  and 21:30 choices.
- Typed analytics records setting changes without storing notification content or
  user Memory data.

## Visual and interaction audit

| Dimension          | Result | Evidence                                                                                                                                |
| ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy          | Pass   | Editorial numbering, restrained rules, and large serif headings keep Settings consistent with Today and Memory detail.                  |
| Theme integrity    | Pass   | Obsidian and Ivory runtime captures preserve semantic contrast; user palette colors remain decorative.                                  |
| Localization       | Pass   | Vietnamese copy reflows without truncating primary controls or tab labels.                                                              |
| Interaction        | Pass   | Switches expose state, theme/language/time controls use radio semantics, and all targets are at least 44 points.                        |
| Persistence        | Pass   | Runtime storage contains a notification identifier plus `vi` and `ivory`; the same state restored after process termination and launch. |
| Native integration | Pass   | The rebuilt iOS binary links `ExpoNotifications 55.0.25`; enabling reminders created a real daily schedule identifier.                  |

## Remaining device QA

1. Notification delivery at the selected wall-clock time must still be observed on a
   physical iPhone; the simulator proves permission/scheduling and persistence, not
   lock-screen delivery policy.
2. Haptic intensity should receive a physical-device feel pass because the simulator
   cannot reproduce the Taptic Engine.
3. Compact iPhone and iPad screenshots remain part of the broader responsive QA
   backlog.

## Verification

- Workspace typecheck and lint pass.
- Domain preference tests and mobile repository round-trip tests pass.
- Native iOS build succeeds with zero errors.
- Expo dependency validation reports all packages up to date.
