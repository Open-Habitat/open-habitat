---
created: 2026-10-31
updated: 2026-10-31
type: improvement
reporter: jari
status: done
priority: normal
lane: dictation-cancel-no-restore
lane_seq: 1
related: ['@dictation-bar-default']
preparation: ready
closed: 2026-10-31
---

# Cancelled dictation needs no restore

Jari 31.10. (reviewing the 31.10. decisions): a cancelled dictation does not need to be restorable. Remove the *Sanelu peruttu* notice with *Palauta* that `dictation-bar-default` added (`issues/dictation-bar-default/result.md`, Decisions): cancel simply discards the dictated words. Remove its code, catalog strings, tests and spec steps; update `KOKEILTAVAA.md`.
