---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: done
priority: normal
lane: experimental
lane_seq: 3
preparation: ready
blocked_by: ['@proto-experimental-features', '@experimental-features-section']
closed: 2026-10-29
---

# Experimental: read-only mirror of a terminal Pi's tmux window

_Source: chat_

## Description

Implement `proto-open-in-terminal` direction **Katso** (Jari 29.10.): a terminal-started Pi conversation shown read-only in the browser offers a read-only mirror of its tmux window in the browser's terminal area. Jari's choice accepts reaching the person's own tmux socket across the daemon's PrivateTmp (same Unix user; decision 5 in the prototype result). The explanatory text is too long: Jari quoted "Pi kirjoittaa tähän keskusteluun tmux-istunnossa work, ikkunassa 2 pi. Selain näyttää historian vain luettavana. Paneeli näyttää ikkunan sellaisenaan, mutta ei kirjoita siihen." Make it one short sentence. Implementation order from the result: PID/environ from the census, then the socket proof, then the mirror. An experimental feature behind its switch.

## Acceptance Criteria

- [x] Mirror of the writer's tmux window, read-only, scoped to the conversation's workspace.
- [x] Short text; without tmux, show only.
- [x] Behind the experimental switch; tests; KOKEILTAVAA line.
