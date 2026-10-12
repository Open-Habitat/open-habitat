# Agent-turn presentation — synthetic evidence

The shared production turn renders native history and provisional work with one
head, work rows, reply bubble and final status strip. One-line thinking renders
Markdown on the row; multi-line thinking is an expandable quote. Saved
consecutive assistant replies become separate threads. The host has no reliable
elapsed duration in a history page, so the settled row omits duration; live
elapsed time appears only when the journal contains a `turn_start` timestamp.

Synthetic lab captures pair PNG and static HTML for `history-short`,
`history-long-multiline` and `live-running`, each at 1440 and 390 px in both
light and dark. The turn crops hide the unrelated sticky recap *only for the
capture*; they do not change the component. The fake Pi supplies no provider
thinking timing or real model. `pairs/report.md` records the measured fidelity
comparison with the draft and its fixture/model-label differences.

Validation of implementation commit `7d89caa`: `./scripts/test-web-fast.sh`
passed (109 web unit, 90 component cases), and the focused host-backed
browser case for the saved assistant turn passed. The first full clean gate
caught browser layout regressions in blocked send and phone widths, and a
production-control audit failure: turn and card buttons bypassed the shared
control primitive. Remediation moves those buttons to `ControlButton` /
`IconButton`, keeps their compact prototype dimensions, suppresses a duplicate
blocked-send reason beside the editor, and updates the phone assertion to
check the send button's intentional position beside the editor. The targeted
four browser cases and fast web gate passed after this change. The paired
screenshots and HTML record the initial implementation commit; the primitive
remediation affects control behavior and markup, not the intended turn/card
layout.
