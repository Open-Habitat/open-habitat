---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
lane: signin-fix
lane_seq: 8
collision: [web/]
---

# Bash tool card hides the command and scatters the result header

During Jari's first real Pi conversation on pilot.22 on 2026-10-12, the bash
card hid the command behind an "Argumentit" disclosure labelled
"Työkalukutsu · bash · call_35c7…|fc_023b…". Its result heading, preview label
and Alku/Loppu controls occupied separate rows, making their relationship
unclear.

The card should make it easy to see what ran and read its output. Show a
compact command preview by default, expandable to the full command. The
internal call ID offers no help with that task; it belongs, if anywhere,
in technical details.

Jari's intended result header is one row: bold "Tulos" on the left and
"Esikatselu:" with an Alku/Loppu segmented button group on the right. These
are mutually exclusive preview positions. When the whole output fits,
the selector has no purpose and is hidden. The existing tool-specific
preview defaults and remembered selection are described in
[design.md](../../design-system/design.md).

Other tool cards using the shared presentation should follow the same
principles, showing their own relevant arguments rather than an internal
identifier. The command, output and controls should remain understandable
in both live work and history. Short and long outputs in the lab, on desktop
and phone, provide the useful comparison: the command is discoverable, the
header reads as one unit, and preview controls appear only when needed.
