# Risk register

| Risk                                    | Impact | Mitigation                                      | Trigger                      |
| --------------------------------------- | ------ | ----------------------------------------------- | ---------------------------- |
| JS JPEG decoding stalls low-end devices | high   | 64 px budget, measure, replace behind extractor | p95 > 750 ms                 |
| HEIC/large image memory pressure        | high   | normalize natively before decoding              | crash or >120 MB delta       |
| Picker URI expires                      | high   | copy only after confirmation                    | missing image after relaunch |
| Mock catalogue hides API constraints    | medium | explicit provider contract states               | Spotify adapter begins       |
| Dynamic colors fail contrast            | high   | safe foreground utility and neutral shell       | AA test failure              |
| AsyncStorage capacity grows             | medium | move metadata to SQLite before sync             | 500+ Memories                |
| No backend yet                          | medium | local-first label and queued architecture       | M3 starts                    |
| Expo SDK churn                          | medium | pin SDK/package manager and validate config     | upgrade proposal             |
| Expo online/offline RN metadata differ  | medium | keep verified RN 0.83.6; recheck before updates | install-check output changes |
