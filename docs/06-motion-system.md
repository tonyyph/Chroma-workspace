# Motion system

Motion expresses transformation from photograph to palette and continuity from
card to detail.

| Interaction        | Purpose                  | Timing            | Reduced motion | Performance            |
| ------------------ | ------------------------ | ----------------- | -------------- | ---------------------- |
| Button press       | tactile acknowledgement  | 120 ms ease-out   | opacity only   | transform on UI thread |
| Palette reveal     | show extraction order    | 220 ms staggered  | immediate      | opacity/transform only |
| Screen entry       | preserve flow continuity | 260 ms ease-out   | crossfade      | no layout animation    |
| Saved confirmation | confirm durable action   | spring, <= 420 ms | static icon    | bounded element        |
| Chromatic study    | reveal palette character | 360 ms staggered  | immediate      | opacity only           |

No animation blocks input. Full-screen animated gradients and continuous blur are
excluded from the first slice. Haptics occur only for successful palette extraction
and Memory save.

Reanimated 4 is compiled with the required `react-native-worklets/plugin`. Jest uses
the official Worklets mock and Reanimated test setup so animation imports are covered
without requiring a native runtime.
