---
created: 2026-11-14
updated: 2026-11-14
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-14/long-reply-text-hidden-in-work
lane: unlaned
lane_seq: 1
preparation: ready
---

# Long text written before a tool call hides in folded work

## Description

Jari 14.11.2026 (test server): the agent wrote a long text at the start of a
turn (a summary and instructions), ran two commands, and ended the turn with
one short paragraph. The "Vastaus valmis" card showed only the last
paragraph, and Jari thought the reply came from the wrong conversation
("Miten ihmeessä tähän tuli tällainen vastaus? Väärään chattiin jotain?").
The opening text was presumably inside the folded "3 ajatusta · 2 työkalua"
row (not verified). The same evening in another conversation, text written
between tools showed as its own "Välivastaus" card.

Expected: text the agent writes to the person is never hidden in folded
work. Find when text before or between tools becomes an interim reply and
when it folds into the work, and make a long person-facing text before a
tool call visible (as an interim reply or as part of the final reply).
