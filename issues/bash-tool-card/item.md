---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: in-progress
priority: normal
lane: web
lane_seq: 6
collision: [web/]
preparation: ready
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

The presentation was settled in the agent-turn prototype rounds on
2026-10-12 and is shown in
[Agentin vuoro.proto.html](../../design-system/drafts/Agentin%20vuoro.proto.html)
(the third bash call in the played turn has a long heredoc command, the
first a 53-line output). It replaces the earlier "Tulos / Esikatselu"
header idea:

- The open card shows the command as `$ command` and the output as a box
  directly below it, with no "Argumentit" heading and no `command` label.
- A multi-line command shows only its first line and "25 riviä · Näytä koko
  komento"; the whole command opens in place.
- An output of more than ten lines opens in the "Alku ja loppu" view: the
  first three and last seven lines with a divider "43 riviä välistä · Näytä
  kaikki". A side rail of icon buttons offers Alku ja loppu, Alkuun, Loppuun
  (a ten-line window scrolled to that end) and Näytä kaikki; beyond forty
  lines also Avaa omassa ikkunassa, which opens the whole output in a dialog
  with line numbers and a copy action. While the tool runs, the box follows
  the end of the output and switches to the edges view when it completes.
  A short output shows plainly without controls.

Other tool cards using the shared presentation should follow the same
principles, showing their own relevant arguments rather than an internal
identifier. The command, output and controls should remain understandable
in both live work and history. Short and long outputs in the lab, on desktop
and phone, provide the useful comparison: the command is discoverable, the
header reads as one unit, and preview controls appear only when needed.
