---
created: 2026-10-23
updated: 2026-10-23
type: improvement
reporter: jari
status: done
priority: normal
preparation: ready
lane: start-guide
lane_seq: 5
collision: [web/src/components/start-page]
closed: 2026-10-23
---

# Start page: insert request with its [placeholder] last and selected

## Description

Jari 2026-10-23: a start-page goal's request may contain a placeholder, e.g. 4dcube's "Etsi DD-aineistosta: [kysymys]. Anna vastaus tarkoilla lähdeviitteillä (S3-avain ja sivu tai solu) ja kerro, onko lähde luonnos vai allekirjoitettu." When Aloita inserts it, the placeholder should end up last and selected: the instruction text, then a blank line, then `[kysymys]` selected, so that typing replaces it. Define how the start-page format marks a placeholder (e.g. `[…]`) and how the skill writes requests accordingly; if a request has no placeholder, keep today's behaviour (caret at end after two newlines). Update the `open-habitat-start-page` skill so generated requests put the placeholder at the end.

## Acceptance Criteria

- [x] Aloita with a placeholder: text, blank line, placeholder selected; typing replaces it; without placeholder unchanged; browser test; skill and format docs updated.
