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

_Source: chat_

Jari, 2026-10-12, pilot.22, first real Pi conversation: the bash tool card.

1. The executed command is not shown. Under "Argumentit" there is only a collapsed "Työkalukutsu · bash · call_35c7…|fc_023b…" disclosure carrying the internal call ID. The card should show the command itself: by default compact (first line or truncated), expandable to the full command. The call ID is internal and does not belong in the visible card (at most in a details view).
2. The result header is broken: "Tulos" on one line, "bash · esikatselun kohta" floating on the next, and the "Alku"/"Loppu" buttons on yet another line, far from that text. Jari's layout: one row with bold "Tulos" on the left and, on the right of the same row, "Esikatselu:" followed by "Alku" and "Loppu" as a segmented button group (they are alternatives).
3. The preview choice is shown only when the output is truncated; when the whole output fits, no Alku/Loppu control is shown.

Apply the same rules to the other tool cards that share this component, and verify in the lab with short and long outputs on desktop and phone.
